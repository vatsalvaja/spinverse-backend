import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { GameRoundStatus, GameSessionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { WalletTransactionType } from '../demo-wallet/enums/wallet-transaction-type.enum';
import { WalletLedgerRepository } from '../demo-wallet/wallet-ledger.repository';
import { ConcurrentUpdateError } from './game-engine.errors';
import {
  RoundListFilter,
  RoundStepRecord,
  RoundWithGame,
  StartRoundRecord,
} from './interfaces/game-session.interface';

const WITH_GAME = { game: { select: { gameId: true } } } satisfies Prisma.GameRoundInclude;
const money = (amount: number): string => amount.toFixed(2);

@Injectable()
export class GameRoundsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: WalletLedgerRepository,
  ) {}

  findInSession(sessionId: string, roundId: string): Promise<RoundWithGame | null> {
    return this.prisma.gameRound.findFirst({ where: { id: roundId, sessionId }, include: WITH_GAME });
  }

  findById(roundId: string): Promise<RoundWithGame | null> {
    return this.prisma.gameRound.findUnique({ where: { id: roundId }, include: WITH_GAME });
  }

  findOpenBySession(sessionId: string): Promise<RoundWithGame | null> {
    return this.prisma.gameRound.findFirst({
      where: { sessionId, status: GameRoundStatus.IN_PROGRESS },
      include: WITH_GAME,
    });
  }

  async findMany(params: {
    filter: RoundListFilter;
    skip: number;
    take: number;
  }): Promise<{ items: RoundWithGame[]; total: number }> {
    const where: Prisma.GameRoundWhereInput = {
      ...(params.filter.sessionId ? { sessionId: params.filter.sessionId } : {}),
      ...(params.filter.userId ? { userId: params.filter.userId } : {}),
      ...(params.filter.gameId ? { gameId: params.filter.gameId } : {}),
      ...(params.filter.status ? { status: params.filter.status } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.gameRound.findMany({
        where,
        include: WITH_GAME,
        orderBy: [{ startedAt: 'desc' }, { id: 'asc' }],
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.gameRound.count({ where }),
    ]);
    return { items, total };
  }

  /**
   * Starts a round in ONE transaction: checks the session has not changed (optimistic lock), posts the entry
   * debit and any instant payout to the wallet ledger (the balance cannot go below zero), updates the session and
   * stores the round with its audit data. If anything fails, nothing is saved: the player is never charged for a
   * round that was not stored, and a round is never stored without its charge.
   */
  startRound(record: StartRoundRecord): Promise<RoundWithGame> {
    return this.prisma.$transaction(async (tx) => {
      // The round id is chosen here so the ledger entries can point at the round and carry round-based
      // idempotency keys, even though the round row is written last.
      const roundId = randomUUID();

      const session = await tx.gameSession.updateMany({
        where: { id: record.session.id, version: record.session.version, status: GameSessionStatus.ACTIVE },
        data: {
          version: { increment: 1 },
          state: record.sessionStateAfter as Prisma.InputJsonObject,
          roundCount: { increment: 1 },
          totalStaked: { increment: money(record.stake) },
          totalPaid: { increment: money(record.credit) },
          lastActivityAt: new Date(),
        },
      });
      if (session.count === 0) throw new ConcurrentUpdateError();

      const reference = { userId: record.userId, gameId: record.gameId, sessionId: record.session.id, roundId };
      let balanceBefore: Prisma.Decimal | null = null;
      let balanceAfter: Prisma.Decimal | null = null;

      if (record.stake > 0) {
        const entry = await this.ledger.post(tx, {
          ...reference,
          type: WalletTransactionType.GAME_ENTRY_DEBIT,
          amount: record.stake,
          idempotencyKey: `round:${roundId}:entry`,
          description: `Game entry (round ${record.roundNumber})`,
        });
        balanceBefore = entry.transaction.balanceBefore;
        balanceAfter = entry.transaction.balanceAfter;
      }
      if (record.credit > 0) {
        const entry = await this.ledger.post(tx, {
          ...reference,
          type: WalletTransactionType.GAME_WINNING_CREDIT,
          amount: record.credit,
          idempotencyKey: `round:${roundId}:win:0`,
          description: `Game winnings (round ${record.roundNumber})`,
        });
        balanceBefore ??= entry.transaction.balanceBefore;
        balanceAfter = entry.transaction.balanceAfter;
      }
      if (!balanceBefore || !balanceAfter) {
        // A free spin or a losing free round moves no credits: the balance is simply unchanged.
        const wallet = await this.ledger.getWallet(tx, record.userId);
        balanceBefore = wallet.balance;
        balanceAfter = wallet.balance;
      }

      return tx.gameRound.create({
        data: {
          id: roundId,
          sessionId: record.session.id,
          userId: record.userId,
          gameId: record.gameId,
          roundNumber: record.roundNumber,
          status: record.status,
          stake: money(record.stake),
          payout: money(record.credit),
          bet: record.bet as Prisma.InputJsonObject,
          result: record.result as Prisma.InputJsonObject,
          roundState: record.roundState as Prisma.InputJsonObject,
          sessionStateBefore: record.sessionStateBefore as Prisma.InputJsonObject,
          engineVersion: record.engineVersion,
          packageVersion: record.packageVersion,
          seed: record.seed,
          seedCommitment: record.seedCommitment,
          rngDraws: record.rngDraws,
          balanceBefore,
          balanceAfter,
          settledAt: record.status === 'SETTLED' ? new Date() : null,
        },
        include: WITH_GAME,
      });
    });
  }

  /**
   * Saves a step of an open round and posts any winnings to the ledger atomically. The round version guards against
   * using the same step twice, and the ledger key includes that version, so winnings can never be credited twice.
   */
  applyStep(record: RoundStepRecord): Promise<RoundWithGame> {
    return this.prisma.$transaction(async (tx) => {
      // Winnings are posted first so the round row can be updated exactly ONCE, with its final balance: a round that
      // settles must never be touched again (the database refuses any change to a settled round). If the version
      // check below then fails (a concurrent request already advanced the round), the whole transaction, including
      // this posting, is rolled back; and the version-based key stops the same winnings from ever being credited twice.
      let balanceAfter: Prisma.Decimal;
      if (record.credit > 0) {
        const entry = await this.ledger.post(tx, {
          userId: record.round.userId,
          gameId: record.round.gameId,
          sessionId: record.round.sessionId,
          roundId: record.round.id,
          type: WalletTransactionType.GAME_WINNING_CREDIT,
          amount: record.credit,
          idempotencyKey: `round:${record.round.id}:win:${record.round.version + 1}`,
          description: 'Game winnings',
        });
        balanceAfter = entry.transaction.balanceAfter;
        await tx.gameSession.update({
          where: { id: record.round.sessionId },
          data: { totalPaid: { increment: money(record.credit) }, lastActivityAt: new Date() },
        });
      } else {
        balanceAfter = (await this.ledger.getWallet(tx, record.round.userId)).balance;
      }

      const updated = await tx.gameRound.updateMany({
        where: { id: record.round.id, version: record.round.version, status: GameRoundStatus.IN_PROGRESS },
        data: {
          version: { increment: 1 },
          status: record.status,
          payout: { increment: money(record.credit) },
          result: record.result as Prisma.InputJsonObject,
          roundState: record.roundState as Prisma.InputJsonObject,
          balanceAfter,
          settledAt: record.status === 'SETTLED' ? new Date() : null,
        },
      });
      if (updated.count === 0) throw new ConcurrentUpdateError();

      return tx.gameRound.findUniqueOrThrow({ where: { id: record.round.id }, include: WITH_GAME });
    });
  }
}
