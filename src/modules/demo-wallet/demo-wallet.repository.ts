import { Injectable } from '@nestjs/common';
import { DemoWallet, Prisma } from '@prisma/client';
import { SortParams } from '../../common/interfaces/pagination.interface';
import { toSortDirection } from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma.service';
import { WalletSortField } from './enums/wallet-sort-field.enum';
import { WalletTransactionType } from './enums/wallet-transaction-type.enum';
import { WalletListFilter, WalletWithUser } from './interfaces/demo-wallet.interface';
import { WalletLedgerRepository } from './wallet-ledger.repository';
import { ZERO_START_ROLES } from './constants/demo-wallet.constants';
import { WalletNotEligibleError } from './wallet.errors';

const WITH_USER = {
  user: { select: { id: true, name: true, email: true, role: true, isActive: true } },
} satisfies Prisma.DemoWalletInclude;

@Injectable()
export class DemoWalletRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: WalletLedgerRepository,
  ) {}

  findByUserId(userId: string): Promise<DemoWallet | null> {
    return this.prisma.demoWallet.findUnique({ where: { userId } });
  }

  /** The role of an account, whether or not it has a wallet yet. */
  async findUserRole(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    return user?.role ?? null;
  }

  findByUserIdWithUser(userId: string): Promise<WalletWithUser | null> {
    return this.prisma.demoWallet.findUnique({ where: { userId }, include: WITH_USER });
  }

  /**
   * Creates the user's wallet and its INITIAL_CREDIT ledger entry in one transaction, so a wallet never exists
   * without the entry that explains its starting balance. Only existing, active users are eligible.
   * A concurrent creation by another request surfaces as a unique-constraint error (P2002) for the caller to handle.
   */
  createWithInitialCredit(userId: string, startingBalance: number): Promise<DemoWallet> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { isActive: true, role: true } });
      if (!user) throw new WalletNotEligibleError('not_found');
      if (!user.isActive) throw new WalletNotEligibleError('inactive');

      const wallet = await tx.demoWallet.create({ data: { userId, balance: '0.00' } });
      // Super Admin / Master / Client wallets start empty (balance 0, no ledger line); coins arrive by allocation.
      if (ZERO_START_ROLES.includes(user.role)) return tx.demoWallet.findUniqueOrThrow({ where: { id: wallet.id } });
      await this.ledger.post(tx, {
        userId,
        type: WalletTransactionType.INITIAL_CREDIT,
        amount: startingBalance,
        idempotencyKey: `initial:${userId}`,
        description: 'Initial demo credits',
      });
      return tx.demoWallet.findUniqueOrThrow({ where: { id: wallet.id } });
    });
  }

  async findManyWithUser(params: {
    filter: WalletListFilter;
    sort: SortParams<WalletSortField>;
    skip: number;
    take: number;
  }): Promise<{ items: WalletWithUser[]; total: number }> {
    const where = this.buildWhere(params.filter);
    const direction = toSortDirection(params.sort.order);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.demoWallet.findMany({
        where,
        include: WITH_USER,
        orderBy: [this.buildOrderBy(params.sort.field, direction), { id: 'asc' }],
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.demoWallet.count({ where }),
    ]);
    return { items, total };
  }

  private buildWhere(filter: WalletListFilter): Prisma.DemoWalletWhereInput {
    const conditions: Prisma.DemoWalletWhereInput[] = [];
    if (filter.status) conditions.push({ status: filter.status });
    if (filter.search) {
      conditions.push({
        user: {
          OR: [
            { name: { contains: filter.search, mode: 'insensitive' } },
            { email: { contains: filter.search, mode: 'insensitive' } },
          ],
        },
      });
    }
    return conditions.length > 0 ? { AND: conditions } : {};
  }

  private buildOrderBy(field: WalletSortField, direction: 'asc' | 'desc'): Prisma.DemoWalletOrderByWithRelationInput {
    switch (field) {
      case WalletSortField.Balance:
        return { balance: direction };
      case WalletSortField.TotalCredited:
        return { totalCredited: direction };
      case WalletSortField.TotalDebited:
        return { totalDebited: direction };
      case WalletSortField.UpdatedAt:
        return { updatedAt: direction };
      case WalletSortField.CreatedAt:
      default:
        return { createdAt: direction };
    }
  }
}
