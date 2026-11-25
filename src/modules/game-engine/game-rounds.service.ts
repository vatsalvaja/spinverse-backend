import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { GameRoundStatus, GameSessionStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { buildPaginatedResult, toSkipTake } from '../../common/utils/pagination.util';
import { DemoWalletService } from '../demo-wallet/demo-wallet.service';
import { GameAvailabilityService } from '../game-packages/game-availability.service';
import { GamesRepository } from '../games/games.repository';
import { SafeUser } from '../users/interfaces/user.interface';
import { ENGINE_ERRORS } from './constants/game-engine.constants';
import { ListAdminRoundsQueryDto } from './dto/list-admin-rounds-query.dto';
import { createRoundSeed, seedCommitment, SeededRng } from './engines/shared/rng';
import { InsufficientBalanceError, mapWalletError } from '../demo-wallet/wallet.errors';
import { ConcurrentUpdateError } from './game-engine.errors';
import { GameEngineRegistry } from './game-engine.registry';
import { GameRoundsRepository } from './game-rounds.repository';
import { GameSessionsService } from './game-sessions.service';
import { JsonObject } from './interfaces/game-engine.interface';
import { RoundAudit, RoundView, RoundWithGame, SessionWithGame } from './interfaces/game-session.interface';
import { asJson, toRoundAudit, toRoundView } from './mappers/game-session.mapper';
import { RoundLifecycleService } from './round-lifecycle.service';

/** Plays rounds. Every random draw, rule and payout comes from the game engine on the server. */
@Injectable()
export class GameRoundsService {
  constructor(
    private readonly roundsRepository: GameRoundsRepository,
    private readonly sessionsService: GameSessionsService,
    private readonly lifecycle: RoundLifecycleService,
    private readonly registry: GameEngineRegistry,
    private readonly availability: GameAvailabilityService,
    private readonly walletService: DemoWalletService,
    private readonly gamesRepository: GamesRepository,
  ) {}

  /**
   * Plays one round: validates the bet, takes the stake, lets the engine draw and settle, and stores the
   * result with its audit data, all atomically.
   */
  async play(user: SafeUser, sessionId: string, rawBet: JsonObject): Promise<RoundView> {
    const session = await this.sessionsService.getOwned(user.id, sessionId);
    this.sessionsService.assertActive(session);
    const engine = this.registry.get(session.game.gameId);
    // Disabled / unpublished games cannot start new rounds. The package version being played is kept with the round.
    const { version: packageVersion } = await this.availability.getLaunchable(session.game.gameId);

    // An earlier round that the clock has finished is settled first; one still running blocks a new round.
    const open = await this.roundsRepository.findOpenBySession(session.id);
    if (open) {
      const { round } = await this.lifecycle.refresh(open, session, engine);
      if (round.status === GameRoundStatus.IN_PROGRESS) throw this.lifecycle.roundInProgress();
    } else if (await this.sessionsService.expireIfIdle(session)) {
      throw new ConflictException(ENGINE_ERRORS.SESSION_EXPIRED);
    }

    const sessionState = asJson(session.state);
    const prepared = this.lifecycle.run(() => engine.prepareBet(rawBet, sessionState));

    const wallet = await this.walletService.getOrCreate(user.id);
    if (wallet.balance < prepared.stake) throw new ConflictException(ENGINE_ERRORS.INSUFFICIENT_CREDITS);

    const seed = createRoundSeed();
    const rng = new SeededRng(seed);
    const step = this.lifecycle.run(() =>
      engine.startRound({ bet: prepared.bet, stake: prepared.stake, sessionState, rng, now: new Date() }),
    );

    try {
      const round = await this.roundsRepository.startRound({
        session: { id: session.id, version: session.version },
        userId: user.id,
        gameId: session.gameId,
        roundNumber: session.roundCount + 1,
        stake: prepared.stake,
        credit: step.credit,
        status: step.status,
        bet: prepared.bet,
        result: step.result,
        roundState: step.roundState,
        sessionStateBefore: sessionState,
        sessionStateAfter: step.sessionState,
        engineVersion: engine.engineVersion,
        packageVersion: packageVersion.version,
        seed,
        seedCommitment: seedCommitment(seed),
        rngDraws: rng.draws,
      });
      return toRoundView(round);
    } catch (error) {
      throw this.mapPersistenceError(error);
    }
  }

  /** A player action inside an open round (e.g. SKYFALL cash-out). */
  async act(user: SafeUser, sessionId: string, roundId: string, action: JsonObject): Promise<RoundView> {
    const session = await this.sessionsService.getOwned(user.id, sessionId);
    const round = await this.getRound(session.id, roundId);
    if (round.status === GameRoundStatus.SETTLED) throw new ConflictException(ENGINE_ERRORS.ROUND_NOT_OPEN);

    const engine = this.registry.get(session.game.gameId);
    if (!engine.applyAction) throw new BadRequestException(ENGINE_ERRORS.ACTIONS_NOT_SUPPORTED);

    const step = this.lifecycle.run(() =>
      engine.applyAction!({
        action,
        bet: asJson(round.bet),
        roundState: asJson(round.roundState),
        sessionState: asJson(session.state),
        now: new Date(),
      }),
    );

    try {
      return toRoundView(await this.lifecycle.save(round, step));
    } catch (error) {
      throw this.mapPersistenceError(error);
    }
  }

  /** One round. An open round is brought up to date from the server clock first. */
  async get(user: SafeUser, sessionId: string, roundId: string): Promise<RoundView> {
    const session = await this.sessionsService.getOwned(user.id, sessionId);
    const found = await this.getRound(session.id, roundId);
    const { round, liveResult } = await this.lifecycle.refresh(found, session, this.registry.get(session.game.gameId));
    return toRoundView(round, liveResult);
  }

  async list(user: SafeUser, sessionId: string, query: PaginationQueryDto): Promise<PaginatedResult<RoundView>> {
    const session = await this.sessionsService.getOwned(user.id, sessionId);

    // Settle a finished open round so the list never shows a stale IN_PROGRESS entry.
    const open = await this.roundsRepository.findOpenBySession(session.id);
    if (open) await this.lifecycle.refresh(open, session, this.registry.get(session.game.gameId));

    const { items, total } = await this.roundsRepository.findMany({
      filter: { sessionId: session.id },
      ...toSkipTake(query.page, query.limit),
    });
    return buildPaginatedResult(items.map((round) => toRoundView(round)), total, query.page, query.limit);
  }

  /**
   * Fairness details of a settled round. The seed is shown once the round is settled, except for games whose
   * seed would also reveal later rounds (e.g. a shuffled deck): those show it after the session has ended.
   */
  async audit(user: SafeUser, sessionId: string, roundId: string): Promise<RoundAudit> {
    const session = await this.sessionsService.getOwned(user.id, sessionId);
    const round = await this.getRound(session.id, roundId);
    this.assertAuditable(round, session);
    return toRoundAudit(round, false);
  }

  // --- administration --------------------------------------------------------

  async listAll(query: ListAdminRoundsQueryDto): Promise<PaginatedResult<RoundView>> {
    let gameRowId: string | undefined;
    if (query.gameId) {
      const game = await this.gamesRepository.findByGameId(query.gameId);
      if (!game) return buildPaginatedResult([], 0, query.page, query.limit);
      gameRowId = game.id;
    }
    const { items, total } = await this.roundsRepository.findMany({
      filter: { gameId: gameRowId, userId: query.userId, status: query.status },
      ...toSkipTake(query.page, query.limit),
    });
    return buildPaginatedResult(items.map((round) => toRoundView(round)), total, query.page, query.limit);
  }

  async getForAdmin(roundId: string): Promise<{ round: RoundView; audit: RoundAudit | null }> {
    const round = await this.roundsRepository.findById(roundId);
    if (!round) throw new NotFoundException(ENGINE_ERRORS.ROUND_NOT_FOUND);
    return {
      round: toRoundView(round),
      // Audit data (seed, private state) is withheld while the round is still open.
      audit: round.status === GameRoundStatus.SETTLED ? toRoundAudit(round, true) : null,
    };
  }

  // --- helpers -----------------------------------------------------------------

  private async getRound(sessionId: string, roundId: string): Promise<RoundWithGame> {
    const round = await this.roundsRepository.findInSession(sessionId, roundId);
    if (!round) throw new NotFoundException(ENGINE_ERRORS.ROUND_NOT_FOUND);
    return round;
  }

  private assertAuditable(round: RoundWithGame, session: SessionWithGame): void {
    if (round.status !== GameRoundStatus.SETTLED) throw new ConflictException(ENGINE_ERRORS.AUDIT_NOT_READY);
    const engine = this.registry.get(session.game.gameId);
    const revealNow = engine.seedRevealPolicy === 'ON_SETTLE' || session.status !== GameSessionStatus.ACTIVE;
    if (!revealNow) {
      throw new ConflictException('The seed of this game is revealed when the session ends. Close the session to see it.');
    }
  }

  private mapPersistenceError(error: unknown): Error {
    // An empty wallet is reported with the game's own wording; other wallet problems (suspended, ...) keep theirs.
    if (error instanceof InsufficientBalanceError) return new ConflictException(ENGINE_ERRORS.INSUFFICIENT_CREDITS);
    const walletError = mapWalletError(error);
    if (walletError) return walletError;
    if (error instanceof ConcurrentUpdateError) return new ConflictException(ENGINE_ERRORS.CONCURRENT_UPDATE);
    return error instanceof Error ? error : new Error(String(error));
  }
}
