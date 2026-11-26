import { Injectable } from '@nestjs/common';
import { CoinTransfer, DemoWallet, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { CoinTransferType } from './coin-transfer.constants';
import { CoinTransferFilter, MasterCoinSummary } from './coin-transfer.interface';

const PARTY_SELECT = { id: true, name: true, email: true, role: true } satisfies Prisma.UserSelect;
const WITH_PARTIES = {
  sender: { select: PARTY_SELECT },
  receiver: { select: PARTY_SELECT },
} satisfies Prisma.CoinTransferInclude;

export type CoinTransferWithParties = Prisma.CoinTransferGetPayload<{ include: typeof WITH_PARTIES }>;

/** An account as the transfer rules need to see it. */
export interface TransferParty {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  parentId: string | null;
  deletedAt: Date | null;
}

/** Database access for coin transfers. Methods that take `db` run inside the caller's transaction when given one. */
@Injectable()
export class CoinTransferRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The client to use outside a transaction. */
  get db(): Prisma.TransactionClient {
    return this.prisma;
  }

  findParty(db: Prisma.TransactionClient, id: string): Promise<TransferParty | null> {
    return db.user.findUnique({
      where: { id },
      select: { ...PARTY_SELECT, isActive: true, parentId: true, deletedAt: true },
    });
  }

  /**
   * Locks the wallets of the given users for the rest of the transaction, always in the same order (by wallet id),
   * so two transfers that touch the same wallets queue up instead of deadlocking.
   */
  async lockWallets(db: Prisma.TransactionClient, userIds: string[]): Promise<void> {
    await db.$queryRaw(
      Prisma.sql`SELECT "id" FROM "demo_wallets" WHERE "userId" IN (${Prisma.join(userIds)}) ORDER BY "id" FOR UPDATE`,
    );
  }

  findWallet(db: Prisma.TransactionClient, userId: string): Promise<DemoWallet | null> {
    return db.demoWallet.findUnique({ where: { userId } });
  }

  findByKey(idempotencyKey: string, db: Prisma.TransactionClient = this.prisma): Promise<CoinTransferWithParties | null> {
    return db.coinTransfer.findUnique({ where: { idempotencyKey }, include: WITH_PARTIES });
  }

  create(
    db: Prisma.TransactionClient,
    data: Prisma.CoinTransferUncheckedCreateInput,
  ): Promise<CoinTransferWithParties> {
    return db.coinTransfer.create({ data, include: WITH_PARTIES });
  }

  async findMany(params: {
    filter: CoinTransferFilter;
    skip: number;
    take: number;
  }): Promise<{ items: CoinTransferWithParties[]; total: number }> {
    const where = this.buildWhere(params.filter);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.coinTransfer.findMany({
        where,
        include: WITH_PARTIES,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.coinTransfer.count({ where }),
    ]);
    return { items, total };
  }

  /** Spendable balance of several users (0 for a user without a wallet). */
  async balancesOf(userIds: string[]): Promise<Map<string, number>> {
    const balances = new Map<string, number>(userIds.map((id) => [id, 0]));
    if (userIds.length === 0) return balances;
    const wallets = await this.prisma.demoWallet.findMany({ where: { userId: { in: userIds } }, select: { userId: true, balance: true } });
    for (const wallet of wallets) balances.set(wallet.userId, wallet.balance.toNumber());
    return balances;
  }

  /** Balance, total received and net distributed for several masters. */
  async masterSummaries(masterIds: string[]): Promise<Map<string, MasterCoinSummary>> {
    const result = new Map<string, MasterCoinSummary>(masterIds.map((id) => [id, { balance: 0, totalReceived: 0, totalDistributed: 0 }]));
    if (masterIds.length === 0) return result;

    const [balances, rows] = await Promise.all([
      this.balancesOf(masterIds),
      this.prisma.coinTransfer.groupBy({
        by: ['masterId', 'type'],
        where: { masterId: { in: masterIds } },
        _sum: { amount: true },
        orderBy: [{ masterId: 'asc' }, { type: 'asc' }],
      }),
    ]);
    for (const id of masterIds) result.get(id)!.balance = balances.get(id) ?? 0;
    for (const row of rows) {
      const entry = result.get(row.masterId);
      if (!entry) continue;
      const sum = (row._sum.amount ?? new Prisma.Decimal(0)).toNumber();
      if (row.type === CoinTransferType.MASTER_ALLOCATION) entry.totalReceived += sum;
      else if (row.type === CoinTransferType.CLIENT_ALLOCATION) entry.totalDistributed += sum;
      else if (row.type === CoinTransferType.CLIENT_RECLAIM) entry.totalDistributed -= sum;
    }
    return result;
  }

  /** System-wide totals for the Super Admin overview. */
  async systemTotals(): Promise<{ totalIssued: number; totalDistributed: number; totalTransfers: number }> {
    const rows = await this.prisma.coinTransfer.groupBy({
      by: ['type'],
      _sum: { amount: true },
      _count: { _all: true },
      orderBy: { type: 'asc' },
    });
    let issued = 0;
    let distributed = 0;
    let transfers = 0;
    for (const row of rows) {
      const sum = (row._sum.amount ?? new Prisma.Decimal(0)).toNumber();
      transfers += row._count._all;
      if (row.type === CoinTransferType.MASTER_ALLOCATION) issued += sum;
      else if (row.type === CoinTransferType.CLIENT_ALLOCATION) distributed += sum;
      else distributed -= sum;
    }
    return { totalIssued: issued, totalDistributed: distributed, totalTransfers: transfers };
  }

  private buildWhere(filter: CoinTransferFilter): Prisma.CoinTransferWhereInput {
    const conditions: Prisma.CoinTransferWhereInput[] = [];
    if (filter.type) conditions.push({ type: filter.type });
    if (filter.masterId) conditions.push({ masterId: filter.masterId });
    if (filter.senderId) conditions.push({ senderId: filter.senderId });
    if (filter.receiverId) conditions.push({ receiverId: filter.receiverId });
    if (filter.participantId) conditions.push({ OR: [{ senderId: filter.participantId }, { receiverId: filter.participantId }] });
    if (filter.from) conditions.push({ createdAt: { gte: filter.from } });
    if (filter.to) conditions.push({ createdAt: { lte: filter.to } });
    return conditions.length > 0 ? { AND: conditions } : {};
  }
}

export type { CoinTransfer };
