import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DemoWallet, Prisma } from '@prisma/client';
import { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { buildPaginatedResult, toSkipTake } from '../../common/utils/pagination.util';
import {
  DEMO_STARTING_CREDITS,
  TRANSACTION_DIRECTION,
  WALLET_ERRORS,
} from './constants/demo-wallet.constants';
import { ListWalletTransactionsQueryDto } from './dto/list-wallet-transactions-query.dto';
import { WalletTransactionType } from './enums/wallet-transaction-type.enum';
import { DemoWalletRepository } from './demo-wallet.repository';
import { LedgerEntry, PostedEntry, TransactionView, WalletView } from './interfaces/demo-wallet.interface';
import { toTransactionView, toWalletView } from './mappers/wallet.mapper';
import { WalletLedgerRepository } from './wallet-ledger.repository';
import { mapWalletError } from './wallet.errors';

/**
 * Demo credits ("virtual credits": no cash value, never deposited, withdrawn or bought).
 *
 * This service is the reusable API for everything that touches a wallet: one wallet per player, balance and
 * history for the player, and the `credit` / `debit` / `refundGameEntry` operations other modules use.
 * Balances change only through the ledger, with idempotency keys, so no operation can run twice.
 */
@Injectable()
export class DemoWalletService {
  constructor(
    private readonly walletRepository: DemoWalletRepository,
    private readonly ledger: WalletLedgerRepository,
  ) {}

  /**
   * The player's wallet, created (with its INITIAL_CREDIT ledger entry) if it does not exist yet. Safe to call
   * repeatedly and concurrently: there is exactly one wallet per user.
   */
  async ensureWallet(userId: string): Promise<DemoWallet> {
    const existing = await this.walletRepository.findByUserId(userId);
    if (existing) return existing;

    try {
      return await this.walletRepository.createWithInitialCredit(userId, DEMO_STARTING_CREDITS);
    } catch (error) {
      // A concurrent request created it first (unique user): use that one.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const created = await this.walletRepository.findByUserId(userId);
        if (created) return created;
      }
      throw mapWalletError(error) ?? error;
    }
  }

  async getOrCreate(userId: string): Promise<WalletView> {
    return toWalletView(await this.ensureWallet(userId));
  }

  async getBalance(userId: string): Promise<{ balance: number; status: string }> {
    const wallet = await this.ensureWallet(userId);
    return { balance: wallet.balance.toNumber(), status: wallet.status };
  }

  /** The player's own ledger history, newest first. */
  async listTransactions(
    userId: string,
    query: ListWalletTransactionsQueryDto,
  ): Promise<PaginatedResult<TransactionView>> {
    this.assertRange(query.from, query.to);
    await this.ensureWallet(userId);

    const { items, total } = await this.ledger.findMany({
      filter: { userId, type: query.type, direction: query.direction, from: query.from, to: query.to },
      ...toSkipTake(query.page, query.limit),
    });
    return buildPaginatedResult(items.map((item) => toTransactionView(item)), total, query.page, query.limit);
  }

  /** Every ledger entry a round caused (entry, winnings, refund), oldest first. Used by the game history. */
  async getRoundTransactions(roundId: string, admin = false): Promise<TransactionView[]> {
    const entries = await this.ledger.findByRound(roundId);
    return entries.map((entry) => toTransactionView(entry, admin));
  }

  // --- reusable operations for other modules ------------------------------------

  /** Adds credits. `type` must be one of the credit types. Repeating an `idempotencyKey` returns the original entry. */
  async credit(entry: LedgerEntry): Promise<PostedEntry> {
    return this.post(entry, 'CREDIT');
  }

  /** Takes credits, never below zero. `type` must be one of the debit types. Repeating an `idempotencyKey` returns the original entry. */
  async debit(entry: LedgerEntry): Promise<PostedEntry> {
    return this.post(entry, 'DEBIT');
  }

  /**
   * Gives a round's entry cost back (GAME_REFUND). Allowed once per round, and only if the round has an entry
   * charge and has not paid any winnings. Calling it again returns the original refund.
   */
  async refundGameEntry(params: { roundId: string; reason: string; actorId?: string }): Promise<PostedEntry> {
    const entries = await this.ledger.findByRound(params.roundId);
    const entry = entries.find((item) => item.type === WalletTransactionType.GAME_ENTRY_DEBIT);
    if (!entry) throw new NotFoundException(WALLET_ERRORS.REFUND_NO_ENTRY);
    if (entries.some((item) => item.type === WalletTransactionType.GAME_WINNING_CREDIT)) {
      throw new ConflictException(WALLET_ERRORS.REFUND_ALREADY_PAID);
    }

    return this.credit({
      userId: entry.userId,
      type: WalletTransactionType.GAME_REFUND,
      amount: entry.amount.toNumber(),
      idempotencyKey: `round:${params.roundId}:refund`,
      description: params.reason,
      gameId: entry.gameId ?? undefined,
      sessionId: entry.sessionId ?? undefined,
      roundId: params.roundId,
      actorId: params.actorId,
    });
  }

  private async post(entry: LedgerEntry, expected: 'CREDIT' | 'DEBIT'): Promise<PostedEntry> {
    if (TRANSACTION_DIRECTION[entry.type] !== expected) throw new BadRequestException(WALLET_ERRORS.WRONG_TYPE);
    await this.ensureWallet(entry.userId);

    try {
      return await this.ledger.postAtomically(entry);
    } catch (error) {
      throw mapWalletError(error) ?? error;
    }
  }

  private assertRange(from?: Date, to?: Date): void {
    if (from && to && from.getTime() > to.getTime()) throw new BadRequestException(WALLET_ERRORS.INVALID_RANGE);
  }
}
