import { GameRoundStatus, Prisma } from '@prisma/client';
import { JsonObject } from '../../game-engine/interfaces/game-engine.interface';
import { TransactionView } from '../../demo-wallet/interfaces/demo-wallet.interface';
import { RoundOutcome } from '../enums/round-outcome.enum';

export interface HistoryFilter {
  userId?: string;
  /** Game row id (uuid), resolved from the public game id by the service. */
  gameRowId?: string;
  status?: GameRoundStatus;
  outcome?: RoundOutcome;
  /** Range on the round's start time. */
  from?: Date;
  to?: Date;
}

/** A round row as the history queries return it (no seed, private state or session state). */
export interface HistoryListRow {
  id: string;
  sessionId: string;
  userId: string;
  gameId: string;
  roundNumber: number;
  status: GameRoundStatus;
  stake: Prisma.Decimal;
  payout: Prisma.Decimal;
  balanceBefore: Prisma.Decimal;
  balanceAfter: Prisma.Decimal;
  engineVersion: string;
  packageVersion: string | null;
  startedAt: Date;
  settledAt: Date | null;
  game: { gameId: string; name: string };
}

export interface HistoryDetailRow extends HistoryListRow {
  bet: Prisma.JsonValue;
  result: Prisma.JsonValue;
  seedCommitment: string;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
}

/** One round in a history list. */
export interface RoundHistoryItem {
  id: string;
  sessionId: string;
  userId: string;
  /** Present in admin views. */
  user?: UserSummary;
  /** Public game id, e.g. `roulette`. */
  gameId: string;
  gameName: string;
  roundNumber: number;
  status: GameRoundStatus;
  /** null while the round is still in progress. */
  outcome: RoundOutcome | null;
  /** Credits wagered (the entry cost). */
  stake: number;
  /** Credits paid out (for a round in progress: paid so far). */
  payout: number;
  /** payout - stake. */
  net: number;
  balanceBefore: number;
  balanceAfter: number;
  /** Version of the game algorithm that produced the result. */
  engineVersion: string;
  /** Version of the game package that was published when the round started (null for very old rounds). */
  packageVersion: string | null;
  startedAt: Date;
  settledAt: Date | null;
  durationMs: number | null;
}

export interface WalletRoundSummary {
  /** Credits taken as the entry cost. */
  entryDebits: number;
  /** Credits paid as winnings (all steps added together). */
  winnings: number;
  /** Credits given back by refunds. */
  refunds: number;
  /** winnings + refunds - entryDebits */
  net: number;
}

/** One round with its game-specific result and every wallet ledger entry it caused. */
export interface RoundHistoryDetail extends RoundHistoryItem {
  /** The bet as validated and stored by the server. */
  bet: JsonObject;
  /** The authoritative result exactly as stored when the round was played (never recalculated). */
  result: JsonObject;
  /** Fingerprint of the round's seed; see the round audit endpoints for the fairness details. */
  seedCommitment: string;
  wallet: {
    /** Entries separate: entry debits, winnings (several for a multi-step round) and refunds. */
    transactions: TransactionView[];
    summary: WalletRoundSummary;
  };
}

export interface GameBreakdown {
  gameId: string;
  gameName: string;
  games: number;
  wins: number;
  losses: number;
  even: number;
  wagered: number;
  winnings: number;
  net: number;
}

export interface HistoryStats {
  /** Settled (completed) rounds. */
  totalGames: number;
  wins: number;
  losses: number;
  even: number;
  /** Rounds still open (not counted in the figures above). */
  inProgress: number;
  /** Credits staked in the settled rounds. */
  wagered: number;
  /** Credits paid in the settled rounds. */
  winnings: number;
  /** winnings - wagered. */
  net: number;
  /** wins / totalGames (0 when there are none). */
  winRate: number;
  averageStake: number;
  /** The largest payout of a single round. */
  biggestPayout: number;
  perGame: GameBreakdown[];
  range: { from: Date | null; to: Date | null };
}

/** Raw group results used to build `HistoryStats`. */
export interface StatsGroup {
  gameRowId: string;
  games: number;
  wagered: Prisma.Decimal;
  winnings: Prisma.Decimal;
}

export interface StatsRaw {
  settled: { count: number; wagered: Prisma.Decimal; winnings: Prisma.Decimal; biggestPayout: Prisma.Decimal };
  inProgress: number;
  wins: number;
  losses: number;
  perGame: StatsGroup[];
  perGameWins: Map<string, number>;
  perGameLosses: Map<string, number>;
  gameNames: Map<string, { gameId: string; name: string }>;
}

/** Whole-platform play totals (dashboard). */
export interface PlayTotals {
  sessions: { total: number; active: number };
  rounds: { settled: number; inProgress: number };
  wagered: number;
  winnings: number;
}

export interface GameReportRow {
  gameId: string;
  gameName: string;
  rounds: number;
  settled: number;
  inProgress: number;
  /** Rounds whose entry was refunded (ledger GAME_REFUND). */
  refunded: number;
  players: number;
  wins: number;
  wagered: number;
  winnings: number;
  net: number;
  /** winnings / wagered, as a percentage; null when nothing was wagered. */
  observedReturnPercent: number | null;
}

export interface DailyActivityRow {
  /** YYYY-MM-DD (UTC). */
  date: string;
  rounds: number;
  activePlayers: number;
  wagered: number;
  winnings: number;
  net: number;
}

export interface UserActivityRow {
  userId: string;
  user?: UserSummary;
  rounds: number;
  wagered: number;
  winnings: number;
  net: number;
  lastActiveAt: Date | null;
}
