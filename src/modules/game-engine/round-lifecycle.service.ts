import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ENGINE_ERRORS } from './constants/game-engine.constants';
import { EngineRuleError } from './engines/shared/engine-rule-error';
import { ConcurrentUpdateError } from './game-engine.errors';
import { GameRoundsRepository } from './game-rounds.repository';
import { GameEngine, JsonObject, RoundStep } from './interfaces/game-engine.interface';
import { RoundWithGame, SessionWithGame } from './interfaces/game-session.interface';
import { asJson } from './mappers/game-session.mapper';

/**
 * Keeps open (IN_PROGRESS) rounds up to date. A round that elapsed time decides (a SKYFALL flight) is
 * advanced from the SERVER clock whenever it is read, acted on, or a new round is started, so a player
 * can never keep a round open to dodge its result.
 */
@Injectable()
export class RoundLifecycleService {
  constructor(private readonly roundsRepository: GameRoundsRepository) {}

  /**
   * Advances an open round to `now`. Returns the stored round (updated if the clock settled anything)
   * and, when nothing needed saving, the live view of the result for display.
   *
   * Contract for engines: a time-driven change to the round's private state must pay a credit or settle the
   * round, so "nothing to save" is detected from `credit` and `status`.
   */
  async refresh(
    round: RoundWithGame,
    session: SessionWithGame,
    engine: GameEngine,
    now: Date = new Date(),
  ): Promise<{ round: RoundWithGame; liveResult?: JsonObject }> {
    if (round.status === 'SETTLED' || !engine.resolveRound) return { round };

    const step = this.run(() =>
      engine.resolveRound!({
        bet: asJson(round.bet),
        roundState: asJson(round.roundState),
        sessionState: asJson(session.state),
        now,
      }),
    );

    if (step.credit === 0 && step.status === round.status) return { round, liveResult: step.result };

    try {
      return { round: await this.save(round, step) };
    } catch (error) {
      if (error instanceof ConcurrentUpdateError) {
        // Another request already advanced this round: use what it saved.
        const latest = await this.roundsRepository.findById(round.id);
        return { round: latest ?? round };
      }
      throw error;
    }
  }

  /** Persists a step of an open round (credit, status, result, state) in one transaction. */
  save(round: RoundWithGame, step: RoundStep): Promise<RoundWithGame> {
    return this.roundsRepository.applyStep({
      round: {
        id: round.id,
        version: round.version,
        sessionId: round.sessionId,
        userId: round.userId,
        gameId: round.gameId,
      },
      status: step.status,
      credit: step.credit,
      result: step.result,
      roundState: step.roundState,
    });
  }

  /** Runs engine code and turns a broken game rule into the matching HTTP error. */
  run<T>(work: () => T): T {
    try {
      return work();
    } catch (error) {
      if (error instanceof EngineRuleError) {
        if (error.kind === 'conflict') throw new ConflictException(error.message);
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /** The error to use when an open round blocks a new one. */
  roundInProgress(): ConflictException {
    return new ConflictException(ENGINE_ERRORS.ROUND_IN_PROGRESS);
  }
}
