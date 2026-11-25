import { GameRound, GameRoundStatus, GameSession } from '@prisma/client';
import { JsonObject, RoundStatus } from './game-engine.interface';

export type SessionWithGame = GameSession & { game: { gameId: string } };
export type RoundWithGame = GameRound & { game: { gameId: string } };

/** Everything persisted atomically when a round starts (stake, optional instant payout, session state, round row). */
export interface StartRoundRecord {
  session: { id: string; version: number };
  userId: string;
  /** Game row id (uuid). */
  gameId: string;
  roundNumber: number;
  stake: number;
  credit: number;
  status: RoundStatus;
  bet: JsonObject;
  result: JsonObject;
  roundState: JsonObject;
  sessionStateBefore: JsonObject;
  sessionStateAfter: JsonObject;
  engineVersion: string;
  /** The published package version being played, kept with the round for the historical record. */
  packageVersion: string | null;
  seed: string;
  seedCommitment: string;
  rngDraws: number;
}

/** Everything persisted atomically when an open round advances (cash-out, crash, ...). */
export interface RoundStepRecord {
  round: { id: string; version: number; sessionId: string; userId: string; gameId: string };
  status: RoundStatus;
  credit: number;
  result: JsonObject;
  roundState: JsonObject;
}

export interface RoundListFilter {
  sessionId?: string;
  userId?: string;
  /** Game row id (uuid). */
  gameId?: string;
  status?: GameRoundStatus;
}

/** A session as returned by the API. */
export interface SessionView {
  id: string;
  gameId: string;
  status: string;
  roundCount: number;
  totalStaked: number;
  totalPaid: number;
  startedAt: Date;
  lastActivityAt: Date;
  endedAt: Date | null;
  engineVersion: string;
  /** What the engine lets the player see of its state (e.g. free spins left). */
  state: JsonObject;
  /** The player's demo balance after the latest change. */
  balance: number;
}

/** A round as returned by the API. */
export interface RoundView {
  id: string;
  sessionId: string;
  gameId: string;
  roundNumber: number;
  status: RoundStatus;
  stake: number;
  payout: number;
  net: number;
  bet: JsonObject;
  result: JsonObject;
  /** Shown from the start; the seed itself is revealed later (see the audit endpoint). */
  seedCommitment: string;
  engineVersion: string;
  balanceBefore: number;
  balanceAfter: number;
  startedAt: Date;
  settledAt: Date | null;
}

export interface RoundAudit {
  roundId: string;
  gameId: string;
  engineVersion: string;
  seed: string;
  seedCommitment: string;
  rngDraws: number;
  bet: JsonObject;
  result: JsonObject;
  /** Private mid-round data (e.g. the SKYFALL crash point), shown only for settled rounds. */
  roundState: JsonObject;
  /** SHA-256 of the session state before the round. The state itself is shown to admins only. */
  sessionStateBeforeHash: string;
  /** Admin view only. */
  sessionStateBefore?: JsonObject;
  howToVerify: string;
}
