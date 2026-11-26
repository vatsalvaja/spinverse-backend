import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Role } from '../../../common/enums/role.enum';
import { PaginatedResult } from '../../../common/interfaces/pagination.interface';
import { buildPaginatedResult, toSkipTake } from '../../../common/utils/pagination.util';
import { PrismaService } from '../../../database/prisma.service';
import { SafeUser } from '../../users/interfaces/user.interface';
import { DemoWalletService } from '../demo-wallet.service';
import { WalletTransactionType } from '../enums/wallet-transaction-type.enum';
import { WalletLedgerRepository } from '../wallet-ledger.repository';
import { IdempotencyConflictError, InsufficientBalanceError, mapWalletError } from '../wallet.errors';
import { COIN_ERRORS, CoinTransferType } from './coin-transfer.constants';
import { CoinAllocationResult, CoinTransferFilter, CoinTransferView, MasterCoinSummary } from './coin-transfer.interface';
import { CoinTransferRepository, CoinTransferWithParties, TransferParty } from './coin-transfer.repository';
import { AllocateCoinsDto } from './coin-transfer.dto';

function toView(row: CoinTransferWithParties): CoinTransferView {
  return {
    id: row.id,
    type: row.type,
    amount: row.amount.toNumber(),
    sender: row.sender,
    receiver: row.receiver,
    masterId: row.masterId,
    senderBalanceAfter: row.senderBalanceAfter ? row.senderBalanceAfter.toNumber() : null,
    receiverBalanceAfter: row.receiverBalanceAfter.toNumber(),
    senderTransactionId: row.senderTransactionId,
    receiverTransactionId: row.receiverTransactionId,
    note: row.note,
    createdAt: row.createdAt,
  };
}

/**
 * The Super Admin -> Master -> Client coin flow, built on the existing demo wallet and ledger (there is no second
 * wallet system). One transfer is ONE database transaction that
 *
 *   1. locks the wallets involved (always in the same order, so concurrent transfers queue instead of deadlocking),
 *   2. re-checks who may send to whom against fresh data,
 *   3. debits the sender wallet (a conditional update, so the balance can never go below zero),
 *   4. credits the receiver wallet,
 *   5. writes both wallet-ledger entries and the `coin_transfers` row that ties them together.
 *
 * Either all of it is stored or none of it. The Super Admin issues coins, so a MASTER_ALLOCATION has no sender
 * debit. Repeating a request with the same idempotency key returns the original transfer and posts nothing.
 */
@Injectable()
export class CoinTransferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: CoinTransferRepository,
    private readonly ledger: WalletLedgerRepository,
    private readonly walletService: DemoWalletService,
  ) {}

  /** Super Admin -> Master. */
  allocateToMaster(actor: SafeUser, masterId: string, dto: AllocateCoinsDto): Promise<CoinAllocationResult> {
    return this.allocate(CoinTransferType.MASTER_ALLOCATION, actor, masterId, dto);
  }

  /** Master -> one of that master's own Clients. */
  allocateToClient(actor: SafeUser, clientId: string, dto: AllocateCoinsDto): Promise<CoinAllocationResult> {
    return this.allocate(CoinTransferType.CLIENT_ALLOCATION, actor, clientId, dto);
  }

  /**
   * Moves a client's remaining balance back to its master, inside the caller's transaction (used when a client is
   * deleted, so nothing is left stranded in a wallet nobody can use). Returns null when there is nothing to return.
   */
  async reclaimBalance(
    tx: Prisma.TransactionClient,
    master: { id: string; name: string },
    client: { id: string; name: string },
  ): Promise<CoinTransferView | null> {
    await this.repository.lockWallets(tx, [master.id, client.id]);
    const wallet = await this.repository.findWallet(tx, client.id);
    if (!wallet || wallet.balance.lte(0)) return null;

    const key = `coin:${CoinTransferType.CLIENT_RECLAIM}:${client.id}`;
    const amount = wallet.balance.toNumber();
    const debit = await this.ledger.post(tx, {
      userId: client.id,
      type: WalletTransactionType.COIN_RECLAIM_DEBIT,
      amount,
      idempotencyKey: `${key}:debit`,
      description: `Remaining coins returned to ${master.name} (account deleted)`,
      actorId: master.id,
    });
    const credit = await this.ledger.post(tx, {
      userId: master.id,
      type: WalletTransactionType.COIN_RECLAIM_CREDIT,
      amount,
      idempotencyKey: `${key}:credit`,
      description: `Remaining coins returned by ${client.name} (account deleted)`,
      actorId: master.id,
    });
    const row = await this.repository.create(tx, {
      type: CoinTransferType.CLIENT_RECLAIM,
      senderId: client.id,
      receiverId: master.id,
      masterId: master.id,
      amount: amount.toFixed(2),
      senderBalanceAfter: debit.transaction.balanceAfter,
      receiverBalanceAfter: credit.transaction.balanceAfter,
      senderTransactionId: debit.transaction.id,
      receiverTransactionId: credit.transaction.id,
      idempotencyKey: key,
      note: 'Client account deleted',
    });
    return toView(row);
  }

  // --- reading -----------------------------------------------------------------

  async list(filter: CoinTransferFilter, page: number, limit: number): Promise<PaginatedResult<CoinTransferView>> {
    if (filter.from && filter.to && filter.from.getTime() > filter.to.getTime()) {
      throw new BadRequestException(COIN_ERRORS.INVALID_RANGE);
    }
    const { items, total } = await this.repository.findMany({ filter, ...toSkipTake(page, limit) });
    return buildPaginatedResult(items.map(toView), total, page, limit);
  }

  masterSummaries(masterIds: string[]): Promise<Map<string, MasterCoinSummary>> {
    return this.repository.masterSummaries(masterIds);
  }

  async masterSummary(masterId: string): Promise<MasterCoinSummary> {
    return (await this.repository.masterSummaries([masterId])).get(masterId)!;
  }

  balancesOf(userIds: string[]): Promise<Map<string, number>> {
    return this.repository.balancesOf(userIds);
  }

  systemTotals() {
    return this.repository.systemTotals();
  }

  // --- the transfer itself -----------------------------------------------------

  private async allocate(
    type: CoinTransferType,
    actor: SafeUser,
    receiverId: string,
    dto: AllocateCoinsDto,
  ): Promise<CoinAllocationResult> {
    // Namespaced by sender and receiver, so one account's key can never replay another account's allocation.
    const key = `coin:${type}:${actor.id}:${receiverId}:${dto.idempotencyKey}`;

    const existing = await this.repository.findByKey(key);
    if (existing) return this.replay(existing, actor.id, receiverId, dto.amount);

    try {
      // Clear 403/404/409 answers first (before any wallet is created)...
      await this.checkParties(this.repository.db, type, actor.id, receiverId);
      await this.walletService.ensureWallet(receiverId);
      if (type === CoinTransferType.CLIENT_ALLOCATION) await this.walletService.ensureWallet(actor.id);

      const transfer = await this.prisma.$transaction(async (tx) => {
        await this.repository.lockWallets(tx, type === CoinTransferType.MASTER_ALLOCATION ? [receiverId] : [actor.id, receiverId]);
        // ...and again with the wallets locked, so the checks and the money movement see the same data.
        const { sender, receiver } = await this.checkParties(tx, type, actor.id, receiverId);
        return this.post(tx, type, key, sender, receiver, dto);
      });
      return { transfer, replayed: false };
    } catch (error) {
      // Two requests with the same key raced: one won, this one rolled back and gets the winner's transfer.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const winner = await this.repository.findByKey(key);
        if (winner) return this.replay(winner, actor.id, receiverId, dto.amount);
      }
      if (error instanceof InsufficientBalanceError) throw new ConflictException(COIN_ERRORS.INSUFFICIENT);
      if (error instanceof IdempotencyConflictError) throw new ConflictException(COIN_ERRORS.IDEMPOTENCY_CONFLICT);
      throw mapWalletError(error) ?? error;
    }
  }

  private async post(
    tx: Prisma.TransactionClient,
    type: CoinTransferType,
    key: string,
    sender: TransferParty,
    receiver: TransferParty,
    dto: AllocateCoinsDto,
  ): Promise<CoinTransferView> {
    const isMasterAllocation = type === CoinTransferType.MASTER_ALLOCATION;
    const masterId = isMasterAllocation ? receiver.id : sender.id;

    let senderTransactionId: string | null = null;
    let senderBalanceAfter: Prisma.Decimal | null = null;
    if (!isMasterAllocation) {
      const debit = await this.ledger.post(tx, {
        userId: sender.id,
        type: WalletTransactionType.COIN_ALLOCATION_DEBIT,
        amount: dto.amount,
        idempotencyKey: `${key}:debit`,
        description: `Coins allocated to ${receiver.name}`,
        actorId: sender.id,
      });
      senderTransactionId = debit.transaction.id;
      senderBalanceAfter = debit.transaction.balanceAfter;
    }

    const credit = await this.ledger.post(tx, {
      userId: receiver.id,
      type: WalletTransactionType.COIN_ALLOCATION_CREDIT,
      amount: dto.amount,
      idempotencyKey: `${key}:credit`,
      description: `Coins allocated by ${sender.name}`,
      actorId: sender.id,
    });

    const row = await this.repository.create(tx, {
      type,
      senderId: sender.id,
      receiverId: receiver.id,
      masterId,
      amount: dto.amount.toFixed(2),
      senderBalanceAfter,
      receiverBalanceAfter: credit.transaction.balanceAfter,
      senderTransactionId,
      receiverTransactionId: credit.transaction.id,
      idempotencyKey: key,
      note: dto.note?.trim() || null,
    });
    return toView(row);
  }

  /**
   * Who may send to whom, read from the database (never from the request):
   *  - MASTER_ALLOCATION: an active SUPER_ADMIN to an active MASTER;
   *  - CLIENT_ALLOCATION: an active MASTER to an active CLIENT whose parentId is that very master.
   * A client of another master looks exactly like a client that does not exist (404), so ids cannot be probed.
   */
  private async checkParties(
    db: Prisma.TransactionClient,
    type: CoinTransferType,
    senderId: string,
    receiverId: string,
  ): Promise<{ sender: TransferParty; receiver: TransferParty }> {
    const isMasterAllocation = type === CoinTransferType.MASTER_ALLOCATION;
    const requiredSender = isMasterAllocation ? Role.SUPER_ADMIN : Role.MASTER;

    const sender = await this.repository.findParty(db, senderId);
    if (!sender || sender.deletedAt || sender.role !== requiredSender) throw new ForbiddenException(COIN_ERRORS.FORBIDDEN);
    if (!sender.isActive) throw new ForbiddenException(COIN_ERRORS.SENDER_INACTIVE);

    const receiver = await this.repository.findParty(db, receiverId);
    const owned = isMasterAllocation
      ? receiver?.role === Role.MASTER
      : receiver?.role === Role.CLIENT && receiver.parentId === sender.id;
    if (!receiver || receiver.deletedAt || !owned) {
      throw new NotFoundException(isMasterAllocation ? COIN_ERRORS.MASTER_NOT_FOUND : COIN_ERRORS.CLIENT_NOT_FOUND);
    }
    if (!receiver.isActive) {
      throw new ConflictException(isMasterAllocation ? COIN_ERRORS.MASTER_INACTIVE : COIN_ERRORS.CLIENT_INACTIVE);
    }
    return { sender, receiver };
  }

  private replay(existing: CoinTransferWithParties, senderId: string, receiverId: string, amount: number): CoinAllocationResult {
    if (existing.senderId !== senderId || existing.receiverId !== receiverId || !existing.amount.equals(amount.toFixed(2))) {
      throw new ConflictException(COIN_ERRORS.IDEMPOTENCY_CONFLICT);
    }
    return { transfer: toView(existing), replayed: true };
  }
}
