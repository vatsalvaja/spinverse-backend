import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { GameSessionStatus } from '@prisma/client';
import { DemoWalletService } from '../demo-wallet/demo-wallet.service';
import { GameAvailabilityService } from '../game-packages/game-availability.service';
import { SafeUser } from '../users/interfaces/user.interface';
import { ENGINE_ERRORS, SESSION_IDLE_MS } from './constants/game-engine.constants';
import { GameEngineRegistry } from './game-engine.registry';
import { GameRoundsRepository } from './game-rounds.repository';
import { GameSessionsRepository } from './game-sessions.repository';
import { SessionView, SessionWithGame } from './interfaces/game-session.interface';
import { toSessionView } from './mappers/game-session.mapper';
import { RoundLifecycleService } from './round-lifecycle.service';

@Injectable()
export class GameSessionsService {
  constructor(
    private readonly sessionsRepository: GameSessionsRepository,
    private readonly roundsRepository: GameRoundsRepository,
    private readonly lifecycle: RoundLifecycleService,
    private readonly registry: GameEngineRegistry,
    private readonly availability: GameAvailabilityService,
    private readonly walletService: DemoWalletService,
  ) {}

  /**
   * Starts a play session for a game, or returns the player's current one. Only games that are enabled,
   * published and installed can be played, and only if a game engine exists for them.
   */
  async open(user: SafeUser, gameId: string): Promise<SessionView> {
    const { game } = await this.availability.getLaunchable(gameId);
    const engine = this.registry.get(game.gameId);
    const wallet = await this.walletService.getOrCreate(user.id);

    let session = await this.sessionsRepository.findActive(user.id, game.id);
    if (session && (await this.expireIfIdle(session))) session = null;
    if (!session) session = await this.sessionsRepository.create(user.id, game.id, engine.createSessionState());

    return toSessionView(session, engine, wallet.balance);
  }

  async get(user: SafeUser, sessionId: string): Promise<SessionView> {
    const session = await this.getOwned(user.id, sessionId);
    const wallet = await this.walletService.getOrCreate(user.id);
    return toSessionView(session, this.registry.get(session.game.gameId), wallet.balance);
  }

  /** Ends the session. An open round is settled from the clock first; if it is still open the session stays. */
  async close(user: SafeUser, sessionId: string): Promise<SessionView> {
    const session = await this.getOwned(user.id, sessionId);
    const engine = this.registry.get(session.game.gameId);

    if (session.status === GameSessionStatus.ACTIVE) {
      const open = await this.roundsRepository.findOpenBySession(session.id);
      if (open) {
        const { round } = await this.lifecycle.refresh(open, session, engine);
        if (round.status === 'IN_PROGRESS') throw this.lifecycle.roundInProgress();
      }
      const ended = await this.sessionsRepository.end(session.id, GameSessionStatus.CLOSED);
      const wallet = await this.walletService.getOrCreate(user.id);
      return toSessionView(ended, engine, wallet.balance);
    }

    const wallet = await this.walletService.getOrCreate(user.id);
    return toSessionView(session, engine, wallet.balance);
  }

  /** A session of someone else is reported as not found. */
  async getOwned(userId: string, sessionId: string): Promise<SessionWithGame> {
    const session = await this.sessionsRepository.findById(sessionId);
    if (!session || session.userId !== userId) throw new NotFoundException(ENGINE_ERRORS.SESSION_NOT_FOUND);
    return session;
  }

  /** The session must still be ACTIVE (not closed or expired). */
  assertActive(session: SessionWithGame): void {
    if (session.status !== GameSessionStatus.ACTIVE) throw new ConflictException(ENGINE_ERRORS.SESSION_NOT_ACTIVE);
  }

  /**
   * Expires a session that has been idle too long and has no open round. Returns true when it was expired.
   */
  async expireIfIdle(session: SessionWithGame): Promise<boolean> {
    if (Date.now() - session.lastActivityAt.getTime() < SESSION_IDLE_MS) return false;
    if (await this.roundsRepository.findOpenBySession(session.id)) return false;
    await this.sessionsRepository.end(session.id, GameSessionStatus.EXPIRED);
    return true;
  }
}
