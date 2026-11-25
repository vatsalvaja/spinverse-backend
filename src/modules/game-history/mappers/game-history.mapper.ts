import { GameRoundStatus, Prisma } from '@prisma/client';
import { TransactionView } from '../../demo-wallet/interfaces/demo-wallet.interface';
import { RoundOutcome } from '../enums/round-outcome.enum';
import {
  HistoryDetailRow,
  HistoryListRow,
  RoundHistoryDetail,
  RoundHistoryItem,
  UserSummary,
  WalletRoundSummary,
} from '../interfaces/game-history.interface';

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** WIN / LOSS / EVEN for a settled round; null while it is still in progress. */
export function outcomeOf(status: GameRoundStatus, stake: Prisma.Decimal, payout: Prisma.Decimal): RoundOutcome | null {
  if (status !== GameRoundStatus.SETTLED) return null;
  if (payout.gt(stake)) return RoundOutcome.Win;
  if (payout.lt(stake)) return RoundOutcome.Loss;
  return RoundOutcome.Even;
}

export function toHistoryItem(row: HistoryListRow, user?: UserSummary): RoundHistoryItem {
  const stake = row.stake.toNumber();
  const payout = row.payout.toNumber();
  return {
    id: row.id,
    sessionId: row.sessionId,
    userId: row.userId,
    ...(user ? { user } : {}),
    gameId: row.game.gameId,
    gameName: row.game.name,
    roundNumber: row.roundNumber,
    status: row.status,
    outcome: outcomeOf(row.status, row.stake, row.payout),
    stake,
    payout,
    net: round2(payout - stake),
    balanceBefore: row.balanceBefore.toNumber(),
    balanceAfter: row.balanceAfter.toNumber(),
    engineVersion: row.engineVersion,
    packageVersion: row.packageVersion,
    startedAt: row.startedAt,
    settledAt: row.settledAt,
    durationMs: row.settledAt ? row.settledAt.getTime() - row.startedAt.getTime() : null,
  };
}

/** Entry debits, winnings and refunds, kept separate and added up from the wallet ledger entries. */
export function summarizeWallet(transactions: TransactionView[]): WalletRoundSummary {
  const sum = (type: string) =>
    round2(transactions.filter((entry) => entry.type === type).reduce((total, entry) => total + entry.amount, 0));
  const entryDebits = sum('GAME_ENTRY_DEBIT');
  const winnings = sum('GAME_WINNING_CREDIT');
  const refunds = sum('GAME_REFUND');
  return { entryDebits, winnings, refunds, net: round2(winnings + refunds - entryDebits) };
}

export function toHistoryDetail(
  row: HistoryDetailRow,
  transactions: TransactionView[],
  user?: UserSummary,
): RoundHistoryDetail {
  const asObject = (value: Prisma.JsonValue) =>
    value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

  return {
    ...toHistoryItem(row, user),
    bet: asObject(row.bet),
    result: asObject(row.result),
    seedCommitment: row.seedCommitment,
    wallet: { transactions, summary: summarizeWallet(transactions) },
  };
}
