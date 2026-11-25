// Shared in-memory stand-in for the database transaction used by the wallet and game-round tests.
// (Named *.test.ts so it is excluded from the production build; it contains no tests itself.)
import { Prisma } from '@prisma/client';

export const D = (value: string | number) => new Prisma.Decimal(value);

export interface FakeWallet {
  id: string;
  userId: string;
  status: 'ACTIVE' | 'SUSPENDED';
  balance: Prisma.Decimal;
  totalCredited: Prisma.Decimal;
  totalDebited: Prisma.Decimal;
}
export interface FakeTransaction {
  id: string;
  walletId: string;
  userId: string;
  type: string;
  direction: string;
  amount: Prisma.Decimal;
  balanceBefore: Prisma.Decimal;
  balanceAfter: Prisma.Decimal;
  idempotencyKey: string;
  description: string;
  [key: string]: unknown;
}

/** Just enough of Prisma's transaction client to run the ledger's logic in memory. */
export class FakeDb {
  wallets: FakeWallet[] = [];
  transactions: FakeTransaction[] = [];

  readonly tx: Record<string, any> = {
    walletTransaction: {
      findUnique: async ({ where }: { where: { idempotencyKey: string } }) =>
        this.transactions.find((t) => t.idempotencyKey === where.idempotencyKey) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (this.transactions.some((t) => t.idempotencyKey === data.idempotencyKey)) {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });
        }
        const row = { id: `tx-${this.transactions.length + 1}`, ...data, amount: D(String(data.amount)) } as FakeTransaction;
        this.transactions.push(row);
        return row;
      },
    },
    demoWallet: {
      findUnique: async ({ where }: { where: { id?: string; userId?: string } }) =>
        this.wallets.find((w) => (where.id ? w.id === where.id : w.userId === where.userId)) ?? null,
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const wallet = this.wallets.find((w) => w.id === where.id);
        if (!wallet) throw new Error('not found');
        return wallet;
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, { increment?: string; decrement?: string }> }) => {
        const wallet = this.wallets.find((w) => w.id === where.id);
        if (!wallet || (where.status && wallet.status !== where.status)) return { count: 0 };
        const minimum = (where.balance as { gte?: string } | undefined)?.gte;
        if (minimum !== undefined && wallet.balance.lt(minimum)) return { count: 0 };
        if (data.balance.increment) wallet.balance = wallet.balance.plus(data.balance.increment);
        if (data.balance.decrement) wallet.balance = wallet.balance.minus(data.balance.decrement);
        if (data.totalCredited?.increment) wallet.totalCredited = wallet.totalCredited.plus(data.totalCredited.increment);
        if (data.totalDebited?.increment) wallet.totalDebited = wallet.totalDebited.plus(data.totalDebited.increment);
        return { count: 1 };
      },
    },
  };

  /** The fake behaves like a transaction that is rolled back on error. */
  prisma: Record<string, any> = {
    $transaction: async <T>(work: (tx: unknown) => Promise<T>): Promise<T> => {
      const snapshot = {
        wallets: this.wallets.map((w) => ({ ...w })),
        transactions: [...this.transactions],
      };
      try {
        return await work(this.tx);
      } catch (error) {
        this.wallets = snapshot.wallets;
        this.transactions = snapshot.transactions;
        throw error;
      }
    },
  };
}
