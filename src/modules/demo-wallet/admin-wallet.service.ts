import { randomUUID } from 'node:crypto';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { buildPaginatedResult, toSkipTake } from '../../common/utils/pagination.util';
import { SafeUser } from '../users/interfaces/user.interface';
import { Role } from '../../common/enums/role.enum';
import { HIERARCHY_WALLET_ROLES, WALLET_ERRORS } from './constants/demo-wallet.constants';
import { ListWalletsQueryDto, WalletStatsQueryDto } from './dto/admin-wallet-queries.dto';
import { AdminListWalletTransactionsQueryDto } from './dto/list-wallet-transactions-query.dto';
import { CreditWalletDto, DebitWalletDto } from './dto/wallet-adjustment.dto';
import { WalletTransactionType } from './enums/wallet-transaction-type.enum';
import { DemoWalletRepository } from './demo-wallet.repository';
import { DemoWalletService } from './demo-wallet.service';
import {
  AdjustmentResult,
  AdminWalletView,
  TransactionView,
  WalletStats,
} from './interfaces/demo-wallet.interface';
import { toAdminWalletView, toTransactionView } from './mappers/wallet.mapper';
import { WalletLedgerRepository } from './wallet-ledger.repository';

/** Administration of demo wallets. Every balance change goes through the same ledger as gameplay. */
@Injectable()
export class AdminWalletService {
  constructor(
    private readonly walletRepository: DemoWalletRepository,
    private readonly ledger: WalletLedgerRepository,
    private readonly walletService: DemoWalletService,
  ) {}

  async listWallets(query: ListWalletsQueryDto): Promise<PaginatedResult<AdminWalletView>> {
    const { items, total } = await this.walletRepository.findManyWithUser({
      filter: { search: query.search, status: query.status },
      sort: { field: query.sortBy, order: query.sortOrder },
      ...toSkipTake(query.page, query.limit),
    });
    return buildPaginatedResult(items.map(toAdminWalletView), total, query.page, query.limit);
  }

  /** One player's wallet. A player who has not opened a wallet yet gets one (if their account is active). */
  async getWallet(userId: string): Promise<AdminWalletView> {
    await this.walletService.ensureWallet(userId);
    const wallet = await this.walletRepository.findByUserIdWithUser(userId);
    if (!wallet) throw new NotFoundException(WALLET_ERRORS.NOT_FOUND);
    return toAdminWalletView(wallet);
  }

  /** A player's wallet if one exists. Unlike getWallet it never creates one (safe for read-only overviews). */
  async findWallet(userId: string): Promise<AdminWalletView | null> {
    const wallet = await this.walletRepository.findByUserIdWithUser(userId);
    return wallet ? toAdminWalletView(wallet) : null;
  }

  /** Credits and debits per calendar day (UTC). */
  getDailyTotals(range: { from?: Date; to?: Date }) {
    return this.ledger.dailyTotals(range);
  }

  /** Adds demo credits. `reason` is mandatory and stored in the ledger together with the acting administrator. */
  credit(actor: SafeUser, userId: string, dto: CreditWalletDto): Promise<AdjustmentResult> {
    return this.adjust(actor, userId, dto, dto.type ?? WalletTransactionType.ADMIN_CREDIT);
  }

  /** Takes demo credits; refused if the balance cannot cover it. */
  debit(actor: SafeUser, userId: string, dto: DebitWalletDto): Promise<AdjustmentResult> {
    return this.adjust(actor, userId, dto, WalletTransactionType.ADMIN_DEBIT);
  }

  async listTransactions(query: AdminListWalletTransactionsQueryDto): Promise<PaginatedResult<TransactionView>> {
    if (query.from && query.to && query.from.getTime() > query.to.getTime()) {
      throw new BadRequestException(WALLET_ERRORS.INVALID_RANGE);
    }
    const { items, total } = await this.ledger.findMany({
      filter: {
        userId: query.userId,
        type: query.type,
        direction: query.direction,
        gameId: query.gameId,
        from: query.from,
        to: query.to,
      },
      ...toSkipTake(query.page, query.limit),
    });
    return buildPaginatedResult(items.map((item) => toTransactionView(item, true)), total, query.page, query.limit);
  }

  getStats(query: WalletStatsQueryDto): Promise<WalletStats> {
    if (query.from && query.to && query.from.getTime() > query.to.getTime()) {
      throw new BadRequestException(WALLET_ERRORS.INVALID_RANGE);
    }
    return this.ledger.getStats({ from: query.from, to: query.to });
  }

  private async adjust(
    actor: SafeUser,
    userId: string,
    dto: DebitWalletDto,
    type: WalletTransactionType,
  ): Promise<AdjustmentResult> {
    // Segregation of duties: nobody can top up (or drain) their own wallet.
    if (actor.id === userId) throw new ForbiddenException(WALLET_ERRORS.SELF_ADJUSTMENT);

    // Coins in the Super Admin -> Master -> Client hierarchy move only through allocations (which keep every
    // balance traceable to a sender). A manual adjustment of those wallets is reserved for the Super Admin.
    if (actor.role !== Role.SUPER_ADMIN) {
      const targetRole = await this.walletRepository.findUserRole(userId);
      if (targetRole && HIERARCHY_WALLET_ROLES.includes(targetRole)) throw new ForbiddenException(WALLET_ERRORS.HIERARCHY_ADJUSTMENT);
    }

    // The key is namespaced by administrator and player, so one admin's key can never replay another's operation.
    const idempotencyKey = dto.idempotencyKey
      ? `admin:${actor.id}:${userId}:${dto.idempotencyKey}`
      : `admin:${randomUUID()}`;

    const entry = {
      userId,
      type,
      amount: dto.amount,
      idempotencyKey,
      description: dto.reason,
      actorId: actor.id,
    };
    const posted =
      type === WalletTransactionType.ADMIN_DEBIT
        ? await this.walletService.debit(entry)
        : await this.walletService.credit(entry);

    return {
      transaction: toTransactionView(posted.transaction, true),
      balance: posted.transaction.balanceAfter.toNumber(),
      replayed: posted.replayed,
    };
  }
}
