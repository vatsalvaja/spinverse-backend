import { Injectable } from '@nestjs/common';
import { DemoWallet, Prisma, WalletTransaction } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TRANSACTION_DIRECTION } from './constants/demo-wallet.constants';
import { WalletStatus } from './enums/wallet-status.enum';
import { WalletTransactionDirection } from './enums/wallet-transaction-direction.enum';
import { WalletTransactionType } from './enums/wallet-transaction-type.enum';
import { LedgerEntry, PostedEntry, TransactionFilter, WalletStats } from './interfaces/demo-wallet.interface';
import {
  IdempotencyConflictError,
  InsufficientBalanceError,
  InvalidAmountError,
  WalletNotFoundError,
  WalletSuspendedError,
} from './wallet.errors';

/** Validates an amount and returns it as the 2-decimal string the database stores. */
function toMoney(amount: number): string {
  const cents = amount * 100;
  if (!Number.isFinite(amount) || amount <= 0 || Math.abs(cents - Math.round(cents)) > 1e-6) {
    throw new InvalidAmountError();
  }
  return (Math.round(cents) / 100).toFixed(2);
}

/**
 * The ONLY place where a wallet balance changes. Every change is one atomic step that moves the balance and
 * appends the matching ledger row in the same database transaction:
 *
 *  - credits and debits are conditional updates (`WHERE balance >= amount` for debits), so the balance can
 *    never go negative, even with many simultaneous requests: the database serialises them on the wallet row;
 *  - the ledger row stores the balance before and after, read while the wallet row is locked by this transaction;
 *  - the idempotency key is unique, so the same operation can never be posted twice;
 *  - ledger rows are never updated or deleted (a database trigger enforces it).
 */
@Injectable()
export class WalletLedgerRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Posts one entry inside the caller's transaction (used by game rounds, so the stake / payout and the round row
   * are saved together). Throws a wallet domain error when the entry cannot be posted.
   */
  async post(tx: Prisma.TransactionClient, entry: LedgerEntry): Promise<PostedEntry> {
    const amount = toMoney(entry.amount);

    const existing = await tx.walletTransaction.findUnique({ where: { idempotencyKey: entry.idempotencyKey } });
    if (existing) return { transaction: this.assertSameOperation(existing, entry, amount), replayed: true };

    const wallet = await tx.demoWallet.findUnique({ where: { userId: entry.userId } });
    if (!wallet) throw new WalletNotFoundError();

    const direction = TRANSACTION_DIRECTION[entry.type];
    if (direction === 'CREDIT') {
      const updated = await tx.demoWallet.updateMany({
        where: { id: wallet.id, status: WalletStatus.ACTIVE },
        data: { balance: { increment: amount }, totalCredited: { increment: amount } },
      });
      if (updated.count === 0) throw new WalletSuspendedError();
    } else {
      const updated = await tx.demoWallet.updateMany({
        where: { id: wallet.id, status: WalletStatus.ACTIVE, balance: { gte: amount } },
        data: { balance: { decrement: amount }, totalDebited: { increment: amount } },
      });
      if (updated.count === 0) {
        const current = await tx.demoWallet.findUnique({ where: { id: wallet.id } });
        if (current && current.status !== WalletStatus.ACTIVE) throw new WalletSuspendedError();
        throw new InsufficientBalanceError();
      }
    }

    // This transaction now holds the wallet row lock, so the balance read here cannot change underneath us.
    const after = await tx.demoWallet.findUniqueOrThrow({ where: { id: wallet.id } });
    const balanceBefore = direction === 'CREDIT' ? after.balance.minus(amount) : after.balance.plus(amount);

    const transaction = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        userId: entry.userId,
        type: entry.type,
        direction,
        amount,
        balanceBefore,
        balanceAfter: after.balance,
        gameId: entry.gameId,
        sessionId: entry.sessionId,
        roundId: entry.roundId,
        description: entry.description,
        idempotencyKey: entry.idempotencyKey,
        actorId: entry.actorId,
      },
    });
    return { transaction, replayed: false };
  }

  /**
   * Posts one entry in its own transaction. If two requests with the same idempotency key race, one wins and
   * the other (whose transaction is rolled back) receives the winner's entry.
   */
  async postAtomically(entry: LedgerEntry): Promise<PostedEntry> {
    try {
      return await this.prisma.$transaction((tx) => this.post(tx, entry));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.findByKey(entry.idempotencyKey);
        if (existing) return { transaction: this.assertSameOperation(existing, entry, toMoney(entry.amount)), replayed: true };
      }
      throw error;
    }
  }

  /** The wallet of a user, read inside the caller's transaction. */
  async getWallet(tx: Prisma.TransactionClient, userId: string): Promise<DemoWallet> {
    const wallet = await tx.demoWallet.findUnique({ where: { userId } });
    if (!wallet) throw new WalletNotFoundError();
    return wallet;
  }

  findByKey(idempotencyKey: string): Promise<WalletTransaction | null> {
    return this.prisma.walletTransaction.findUnique({ where: { idempotencyKey } });
  }

  /** Every ledger entry of one round (entry, wins, refund). */
  findByRound(roundId: string): Promise<WalletTransaction[]> {
    return this.prisma.walletTransaction.findMany({ where: { roundId }, orderBy: { createdAt: 'asc' } });
  }

  async findMany(params: {
    filter: TransactionFilter;
    skip: number;
    take: number;
  }): Promise<{ items: WalletTransaction[]; total: number }> {
    const where = this.buildWhere(params.filter);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.walletTransaction.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.walletTransaction.count({ where }),
    ]);
    return { items, total };
  }

  /** Totals over all wallets, plus ledger counts and sums per type (optionally within a date range). */
  async getStats(range: { from?: Date; to?: Date }): Promise<WalletStats> {
    const where = this.buildWhere({ from: range.from, to: range.to });
    const [totals, active, grouped] = await Promise.all([
      this.prisma.demoWallet.aggregate({
        _count: { _all: true },
        _sum: { balance: true, totalCredited: true, totalDebited: true },
      }),
      this.prisma.demoWallet.count({ where: { status: WalletStatus.ACTIVE } }),
      this.prisma.walletTransaction.groupBy({
        by: ['type'],
        where,
        _count: { _all: true },
        _sum: { amount: true },
        orderBy: { type: 'asc' },
      }),
    ]);

    const zero = new Prisma.Decimal(0);
    const balance = totals._sum.balance ?? zero;
    const credited = totals._sum.totalCredited ?? zero;
    const debited = totals._sum.totalDebited ?? zero;

    return {
      wallets: { total: totals._count._all, active, suspended: totals._count._all - active },
      totalBalance: balance.toNumber(),
      totalCredited: credited.toNumber(),
      totalDebited: debited.toNumber(),
      discrepancy: credited.minus(debited).minus(balance).toNumber(),
      byType: grouped.map((row) => ({
        type: row.type,
        direction: TRANSACTION_DIRECTION[row.type] as WalletTransactionDirection,
        count: row._count._all,
        totalAmount: (row._sum.amount ?? zero).toNumber(),
      })),
      range: { from: range.from ?? null, to: range.to ?? null },
    };
  }

  /** Ledger credits, debits and entry counts per calendar day (UTC). */
  async dailyTotals(range: { from?: Date; to?: Date }): Promise<{ date: string; credited: number; debited: number; transactions: number }[]> {
    const parts: Prisma.Sql[] = [Prisma.sql`TRUE`];
    if (range.from) parts.push(Prisma.sql`"createdAt" >= ${range.from}`);
    if (range.to) parts.push(Prisma.sql`"createdAt" <= ${range.to}`);
    const rows = await this.prisma.$queryRaw<
      { date: string; credited: Prisma.Decimal; debited: Prisma.Decimal; transactions: number }[]
    >(Prisma.sql`
      SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS "date",
             COALESCE(SUM("amount") FILTER (WHERE "direction" = 'CREDIT'), 0) AS "credited",
             COALESCE(SUM("amount") FILTER (WHERE "direction" = 'DEBIT'), 0) AS "debited",
             COUNT(*)::int AS "transactions"
      FROM "wallet_transactions"
      WHERE ${Prisma.join(parts, ' AND ')}
      GROUP BY 1
      ORDER BY 1
    `);
    return rows.map((row) => ({ ...row, credited: Number(row.credited), debited: Number(row.debited) }));
  }

  private buildWhere(filter: TransactionFilter): Prisma.WalletTransactionWhereInput {
    const conditions: Prisma.WalletTransactionWhereInput[] = [];
    if (filter.userId) conditions.push({ userId: filter.userId });
    if (filter.type) conditions.push({ type: filter.type as WalletTransactionType });
    if (filter.direction) conditions.push({ direction: filter.direction });
    if (filter.gameId) conditions.push({ gameId: filter.gameId });
    if (filter.from) conditions.push({ createdAt: { gte: filter.from } });
    if (filter.to) conditions.push({ createdAt: { lte: filter.to } });
    return conditions.length > 0 ? { AND: conditions } : {};
  }

  /** A replayed key must describe the very same operation, otherwise it is a client mistake. */
  private assertSameOperation(existing: WalletTransaction, entry: LedgerEntry, amount: string): WalletTransaction {
    if (existing.userId !== entry.userId || existing.type !== entry.type || !existing.amount.equals(amount)) {
      throw new IdempotencyConflictError();
    }
    return existing;
  }
}
