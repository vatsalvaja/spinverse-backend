import { createHash } from 'node:crypto';
import { round2 } from '../engines/shared/engine-helpers';
import { GameEngine, JsonObject, RoundStatus } from '../interfaces/game-engine.interface';
import { RoundAudit, RoundView, RoundWithGame, SessionView, SessionWithGame } from '../interfaces/game-session.interface';
import { AUDIT_HOW_TO_VERIFY } from '../constants/game-engine.constants';

/** Reads a JSON column as a plain object (an empty one when it is null or not an object). */
export function asJson(value: unknown): JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

export function toSessionView(session: SessionWithGame, engine: GameEngine, balance: number): SessionView {
  return {
    id: session.id,
    gameId: session.game.gameId,
    status: session.status,
    roundCount: session.roundCount,
    totalStaked: session.totalStaked.toNumber(),
    totalPaid: session.totalPaid.toNumber(),
    startedAt: session.startedAt,
    lastActivityAt: session.lastActivityAt,
    endedAt: session.endedAt,
    engineVersion: engine.engineVersion,
    state: engine.describeSession(asJson(session.state)),
    balance,
  };
}

/** `liveResult` replaces the stored result of an open round with its up-to-date view. */
export function toRoundView(round: RoundWithGame, liveResult?: JsonObject): RoundView {
  const stake = round.stake.toNumber();
  const payout = round.payout.toNumber();
  return {
    id: round.id,
    sessionId: round.sessionId,
    gameId: round.game.gameId,
    roundNumber: round.roundNumber,
    status: round.status as RoundStatus,
    stake,
    payout,
    net: round2(payout - stake),
    bet: asJson(round.bet),
    result: liveResult ?? asJson(round.result),
    seedCommitment: round.seedCommitment,
    engineVersion: round.engineVersion,
    balanceBefore: round.balanceBefore.toNumber(),
    balanceAfter: round.balanceAfter.toNumber(),
    startedAt: round.startedAt,
    settledAt: round.settledAt,
  };
}

/** Stable hash of a JSON value (keys sorted), so a state can be referred to without revealing it. */
export function hashJson(value: JsonObject): string {
  const canonical = JSON.stringify(value, (_key, entry: unknown) =>
    entry !== null && typeof entry === 'object' && !Array.isArray(entry)
      ? Object.fromEntries(Object.entries(entry as JsonObject).sort(([a], [b]) => (a < b ? -1 : 1)))
      : entry,
  );
  return createHash('sha256').update(canonical).digest('hex');
}

/** Audit data of a SETTLED round. `includeState` (admins only) adds the full session state before the round. */
export function toRoundAudit(round: RoundWithGame, includeState: boolean): RoundAudit {
  const before = asJson(round.sessionStateBefore);
  return {
    roundId: round.id,
    gameId: round.game.gameId,
    engineVersion: round.engineVersion,
    seed: round.seed,
    seedCommitment: round.seedCommitment,
    rngDraws: round.rngDraws,
    bet: asJson(round.bet),
    result: asJson(round.result),
    roundState: asJson(round.roundState),
    sessionStateBeforeHash: hashJson(before),
    ...(includeState ? { sessionStateBefore: before } : {}),
    howToVerify: AUDIT_HOW_TO_VERIFY,
  };
}
