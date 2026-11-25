import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { PrismaService } from '../../database/prisma.service';
import { D, FakeDb } from '../demo-wallet/fake-wallet-db.test';
import { WalletLedgerRepository } from '../demo-wallet/wallet-ledger.repository';
import { InsufficientBalanceError } from '../demo-wallet/wallet.errors';
import { ConcurrentUpdateError } from './game-engine.errors';
import { GameRoundsRepository } from './game-rounds.repository';
import { StartRoundRecord } from './interfaces/game-session.interface';

/** The wallet fake plus the session and round tables the round repository writes to. */
class FakeGameDb extends FakeDb {
  session = { id: 's1', version: 3, status: 'ACTIVE', roundCount: 4, totalStaked: 0, totalPaid: 0 };
  rounds: Record<string, unknown>[] = [];

  constructor() {
    super();
    const baseTransaction = this.prisma.$transaction;
    Object.assign(this.tx, {
      gameSession: {
        updateMany: async ({ where }: { where: { id: string; version: number; status: string } }) => {
          if (where.id !== this.session.id || where.version !== this.session.version || where.status !== this.session.status) {
            return { count: 0 };
          }
          this.session.version++;
          this.session.roundCount++;
          return { count: 1 };
        },
        update: async () => this.session,
      },
      gameRound: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const row = { ...data, version: 0 };
          this.rounds.push(row);
          return row;
        },
        updateMany: async ({ where, data }: { where: { id: string; version: number }; data: { payout: { increment: string }; balanceAfter: unknown } }) => {
          const round = this.rounds.find((r) => r.id === where.id);
          if (!round || round.version !== where.version || round.status !== 'IN_PROGRESS') return { count: 0 };
          round.version = (round.version as number) + 1;
          round.status = 'SETTLED';
          round.payout = D(String(round.payout)).plus(data.payout.increment).toString();
          round.balanceAfter = data.balanceAfter;
          return { count: 1 };
        },
        findUniqueOrThrow: async ({ where }: { where: { id: string } }) => this.rounds.find((r) => r.id === where.id),
      },
    });
    // The whole round (session, wallet, ledger, round row) rolls back together on an error.
    this.prisma.$transaction = async (work: (tx: unknown) => Promise<unknown>) => {
      const before = { session: { ...this.session }, rounds: [...this.rounds] };
      try {
        return await baseTransaction(work);
      } catch (error) {
        this.session = before.session;
        this.rounds = before.rounds;
        throw error;
      }
    };
  }
}

const record = (overrides: Partial<StartRoundRecord> = {}): StartRoundRecord => ({
  session: { id: 's1', version: 3 },
  userId: 'user-1',
  gameId: 'game-uuid',
  roundNumber: 5,
  stake: 100,
  credit: 0,
  status: 'SETTLED',
  bet: {},
  result: {},
  roundState: {},
  sessionStateBefore: {},
  sessionStateAfter: {},
  engineVersion: '1.0.0',
  packageVersion: '2.1.0',
  seed: 'ab',
  seedCommitment: 'cd',
  rngDraws: 1,
  ...overrides,
});

describe('GameRoundsRepository wallet integration', () => {
  let db: FakeGameDb;
  let repository: GameRoundsRepository;

  beforeEach(() => {
    db = new FakeGameDb();
    db.wallets.push({ id: 'w1', userId: 'user-1', status: 'ACTIVE', balance: D(500), totalCredited: D(500), totalDebited: D(0) });
    const prisma = db.prisma as unknown as PrismaService;
    repository = new GameRoundsRepository(prisma, new WalletLedgerRepository(prisma));
  });

  it('charges the entry and pays the win as two ledger entries tied to the round', async () => {
    const round = (await repository.startRound(record({ stake: 100, credit: 250 }))) as unknown as Record<string, unknown>;

    assert.equal(db.transactions.length, 2);
    const [entry, win] = db.transactions;
    assert.equal(entry.type, 'GAME_ENTRY_DEBIT');
    assert.equal(win.type, 'GAME_WINNING_CREDIT');
    for (const row of db.transactions) {
      assert.equal(row.roundId, round.id, 'ledger entries point at the round');
      assert.equal(row.sessionId, 's1');
      assert.equal(row.gameId, 'game-uuid');
    }
    assert.equal(entry.idempotencyKey, `round:${round.id}:entry`);
    assert.equal(win.idempotencyKey, `round:${round.id}:win:0`);

    assert.equal(db.wallets[0].balance.toString(), '650');
    assert.equal(String(round.balanceBefore), '500', 'balance before the stake');
    assert.equal(String(round.balanceAfter), '650', 'balance after the payout');
  });

  it('a lost round only debits; balance before/after reflect the stake', async () => {
    const round = (await repository.startRound(record({ stake: 100, credit: 0 }))) as unknown as Record<string, unknown>;
    assert.deepEqual(db.transactions.map((t) => t.type), ['GAME_ENTRY_DEBIT']);
    assert.equal(String(round.balanceBefore), '500');
    assert.equal(String(round.balanceAfter), '400');
  });

  it('a free spin that wins posts only the winnings', async () => {
    const round = (await repository.startRound(record({ stake: 0, credit: 40 }))) as unknown as Record<string, unknown>;
    assert.deepEqual(db.transactions.map((t) => t.type), ['GAME_WINNING_CREDIT']);
    assert.equal(String(round.balanceBefore), '500');
    assert.equal(String(round.balanceAfter), '540');
  });

  it('a free spin that loses moves no credits and posts nothing', async () => {
    const round = (await repository.startRound(record({ stake: 0, credit: 0 }))) as unknown as Record<string, unknown>;
    assert.equal(db.transactions.length, 0);
    assert.equal(String(round.balanceBefore), '500');
    assert.equal(String(round.balanceAfter), '500');
  });

  it('refuses a stake the wallet cannot cover and saves nothing at all', async () => {
    await assert.rejects(repository.startRound(record({ stake: 600 })), InsufficientBalanceError);
    assert.equal(db.wallets[0].balance.toString(), '500');
    assert.equal(db.transactions.length, 0);
    assert.equal(db.rounds.length, 0);
    assert.equal(db.session.version, 3, 'the session change was rolled back too');
  });

  it('refuses a stale session version before any money moves (no double play)', async () => {
    await repository.startRound(record({ stake: 100 }));
    await assert.rejects(repository.startRound(record({ stake: 100 })), ConcurrentUpdateError); // same version 3 again
    assert.equal(db.wallets[0].balance.toString(), '400', 'charged once');
    assert.equal(db.transactions.length, 1);
  });

  it('pays a step of an open round once: the same step cannot credit twice', async () => {
    const round = (await repository.startRound(record({ stake: 100, status: 'IN_PROGRESS' }))) as unknown as { id: string };
    const step = {
      round: { id: round.id, version: 0, sessionId: 's1', userId: 'user-1', gameId: 'game-uuid' },
      status: 'SETTLED' as const,
      credit: 150,
      result: {},
      roundState: {},
    };

    await repository.applyStep(step);
    assert.equal(db.wallets[0].balance.toString(), '550'); // 500 - 100 + 150
    const win = db.transactions.find((t) => t.type === 'GAME_WINNING_CREDIT');
    assert.equal(win?.idempotencyKey, `round:${round.id}:win:1`);

    await assert.rejects(repository.applyStep(step), ConcurrentUpdateError); // the same step again
    assert.equal(db.wallets[0].balance.toString(), '550', 'no second credit');
    assert.equal(db.transactions.filter((t) => t.type === 'GAME_WINNING_CREDIT').length, 1);
  });
});
