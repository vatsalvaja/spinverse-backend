import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DemoWalletService } from '../demo-wallet/demo-wallet.service';
import { TransactionView } from '../demo-wallet/interfaces/demo-wallet.interface';
import { GamesRepository } from '../games/games.repository';
import { UsersService } from '../users/users.service';
import { ListGameHistoryQueryDto } from './dto/game-history-queries.dto';
import { RoundOutcome } from './enums/round-outcome.enum';
import { GameHistoryRepository } from './game-history.repository';
import { GameHistoryService } from './game-history.service';
import { HistoryDetailRow, HistoryFilter, HistoryListRow, StatsRaw } from './interfaces/game-history.interface';
import { outcomeOf, summarizeWallet, toHistoryItem } from './mappers/game-history.mapper';

const D = (value: string | number) => new Prisma.Decimal(value);

const row = (overrides: Partial<HistoryDetailRow> = {}): HistoryDetailRow => ({
  id: 'round-1',
  sessionId: 's1',
  userId: 'user-1',
  gameId: 'game-uuid',
  roundNumber: 3,
  status: 'SETTLED',
  stake: D(100),
  payout: D(250),
  balanceBefore: D(1000),
  balanceAfter: D(1150),
  engineVersion: '1.0.0',
  packageVersion: '2.3.0',
  startedAt: new Date('2026-11-29T10:00:00.000Z'),
  settledAt: new Date('2026-11-29T10:00:02.500Z'),
  game: { gameId: 'roulette', name: 'Roulette' },
  bet: { bets: [] },
  result: { winningNumber: 17 },
  seedCommitment: 'abc',
  ...overrides,
});

const tx = (type: string, amount: number): TransactionView => ({
  id: `tx-${type}-${amount}`,
  walletId: 'w1',
  userId: 'user-1',
  type: type as TransactionView['type'],
  direction: type.endsWith('DEBIT') ? 'DEBIT' : 'CREDIT',
  amount,
  balanceBefore: 0,
  balanceAfter: 0,
  gameId: 'game-uuid',
  sessionId: 's1',
  roundId: 'round-1',
  description: '',
  createdAt: new Date(),
});

describe('round outcome and mapping', () => {
  it('classifies settled rounds by payout against stake; open rounds have no outcome', () => {
    assert.equal(outcomeOf('SETTLED', D(100), D(100.01)), RoundOutcome.Win);
    assert.equal(outcomeOf('SETTLED', D(100), D(99.99)), RoundOutcome.Loss);
    assert.equal(outcomeOf('SETTLED', D(100), D(100)), RoundOutcome.Even);
    assert.equal(outcomeOf('SETTLED', D(0), D(0)), RoundOutcome.Even, 'a free spin that won nothing');
    assert.equal(outcomeOf('SETTLED', D(0), D(40)), RoundOutcome.Win, 'a free spin that won');
    assert.equal(outcomeOf('IN_PROGRESS', D(100), D(500)), null);
  });

  it('shows stake, payout, net, versions and the duration', () => {
    const item = toHistoryItem(row());
    assert.equal(item.gameId, 'roulette');
    assert.equal(item.gameName, 'Roulette');
    assert.equal(item.stake, 100);
    assert.equal(item.payout, 250);
    assert.equal(item.net, 150);
    assert.equal(item.outcome, 'WIN');
    assert.equal(item.engineVersion, '1.0.0');
    assert.equal(item.packageVersion, '2.3.0');
    assert.equal(item.durationMs, 2500);
  });

  it('has no duration for an open round', () => {
    assert.equal(toHistoryItem(row({ status: 'IN_PROGRESS', settledAt: null })).durationMs, null);
  });
});

describe('wallet summary of a round', () => {
  it('keeps entry debits, winnings and refunds separate', () => {
    const summary = summarizeWallet([tx('GAME_ENTRY_DEBIT', 100), tx('GAME_WINNING_CREDIT', 250.5), tx('GAME_REFUND', 0)].filter((t) => t.amount > 0));
    assert.deepEqual(summary, { entryDebits: 100, winnings: 250.5, refunds: 0, net: 150.5 });
  });

  it('adds up the several winning credits of a multi-step (SKYFALL) round as one round', () => {
    const summary = summarizeWallet([
      tx('GAME_ENTRY_DEBIT', 150),
      tx('GAME_WINNING_CREDIT', 100), // panel 0 cashed out
      tx('GAME_WINNING_CREDIT', 75.5), // panel 1 cashed out later
    ]);
    assert.deepEqual(summary, { entryDebits: 150, winnings: 175.5, refunds: 0, net: 25.5 });
  });

  it('shows a refund separately', () => {
    assert.deepEqual(summarizeWallet([tx('GAME_ENTRY_DEBIT', 50), tx('GAME_REFUND', 50)]), {
      entryDebits: 50,
      winnings: 0,
      refunds: 50,
      net: 0,
    });
  });
});

class FakeRepository {
  lastFilter: HistoryFilter | null = null;
  findManyCalls = 0;
  rows: Record<string, HistoryDetailRow> = { 'round-1': row() };
  detailUserArg: string | undefined | 'unset' = 'unset';
  stats: StatsRaw | null = null;

  async findMany(params: { filter: HistoryFilter; skip: number; take: number }) {
    this.findManyCalls++;
    this.lastFilter = params.filter;
    return { items: [row() as HistoryListRow], total: 1 };
  }
  async findDetail(roundId: string, userId?: string) {
    this.detailUserArg = userId;
    const found = this.rows[roundId];
    return found && (!userId || found.userId === userId) ? found : null;
  }
  async getStatsRaw(filter: HistoryFilter) {
    this.lastFilter = filter;
    return this.stats as StatsRaw;
  }
}

describe('GameHistoryService', () => {
  let repository: FakeRepository;
  let adminFlags: boolean[];
  let service: GameHistoryService;

  beforeEach(() => {
    repository = new FakeRepository();
    adminFlags = [];
    service = new GameHistoryService(
      repository as unknown as GameHistoryRepository,
      {
        findByGameId: async (slug: string) => (slug === 'roulette' ? { id: 'game-uuid', gameId: 'roulette' } : null),
      } as unknown as GamesRepository,
      {
        getRoundTransactions: async (_id: string, admin: boolean) => {
          adminFlags.push(admin);
          return [tx('GAME_ENTRY_DEBIT', 100), tx('GAME_WINNING_CREDIT', 250)];
        },
      } as unknown as DemoWalletService,
      {
        findSummaries: async (ids: string[]) => ids.map((id) => ({ id, name: 'Jane', email: 'jane@example.com' })),
        getById: async (id: string) => ({ id }),
      } as unknown as UsersService,
    );
  });

  const query = (overrides: Partial<ListGameHistoryQueryDto> = {}) =>
    Object.assign(new ListGameHistoryQueryDto(), overrides);

  describe('player scope', () => {
    it('always filters the list by the signed-in user', async () => {
      await service.listForPlayer('user-1', query());
      assert.equal(repository.lastFilter?.userId, 'user-1');
    });

    it('a player cannot read another player\'s round (reported as not found)', async () => {
      repository.rows['round-1'] = row({ userId: 'someone-else' });
      await assert.rejects(service.getPlayerDetail('user-1', 'round-1'), NotFoundException);
      assert.equal(repository.detailUserArg, 'user-1', 'the owner is part of the query itself');
    });

    it('returns the round with its wallet entries, without admin-only fields', async () => {
      const detail = await service.getPlayerDetail('user-1', 'round-1');
      assert.equal(detail.wallet.transactions.length, 2);
      assert.deepEqual(detail.wallet.summary, { entryDebits: 100, winnings: 250, refunds: 0, net: 150 });
      assert.equal(detail.user, undefined);
      assert.deepEqual(adminFlags, [false]);
    });

    it('statistics are scoped to the player', async () => {
      repository.stats = emptyRaw();
      await service.getPlayerStats('user-1', {});
      assert.equal(repository.lastFilter?.userId, 'user-1');
    });

    it('a filter on an unknown game matches nothing without querying', async () => {
      const page = await service.listForPlayer('user-1', query({ gameId: 'no-such-game' }));
      assert.equal(page.items.length, 0);
      assert.equal(page.meta.total, 0);
      assert.equal(repository.findManyCalls, 0);
    });

    it('the per-game route returns 404 for an unknown game', async () => {
      await assert.rejects(service.listForPlayerGame('user-1', 'no-such-game', query()), NotFoundException);
    });

    it('translates the public game id into the stored game when filtering', async () => {
      await service.listForPlayerGame('user-1', 'ROULETTE', query());
      assert.equal(repository.lastFilter?.gameRowId, 'game-uuid');
    });

    it('rejects an inverted date range', async () => {
      await assert.rejects(
        service.listForPlayer('user-1', query({ from: new Date('2026-12-01'), to: new Date('2026-11-01') })),
        BadRequestException,
      );
    });
  });

  describe('admin', () => {
    it('can inspect any round, with player name and admin wallet fields', async () => {
      const detail = await service.getAdminDetail('round-1');
      assert.equal(detail.user?.name, 'Jane');
      assert.equal(repository.detailUserArg, undefined, 'no owner restriction for admins');
      assert.deepEqual(adminFlags, [true]);
    });

    it('lists with the requested user filter and adds player names', async () => {
      const page = await service.listAll(Object.assign(query(), { userId: 'user-9' }) as never);
      assert.equal(repository.lastFilter?.userId, 'user-9');
      assert.equal(page.items[0].user?.email, 'jane@example.com');
    });
  });

  describe('statistics', () => {
    it('derives wins, losses, even, rate, net and the per-game breakdown from the stored totals', async () => {
      repository.stats = {
        settled: { count: 10, wagered: D(1000), winnings: D(900), biggestPayout: D(400) },
        inProgress: 2,
        wins: 3,
        losses: 5,
        perGame: [
          { gameRowId: 'g-a', games: 7, wagered: D(700), winnings: D(500) },
          { gameRowId: 'g-b', games: 3, wagered: D(300), winnings: D(400) },
        ],
        perGameWins: new Map([['g-a', 2], ['g-b', 1]]),
        perGameLosses: new Map([['g-a', 4], ['g-b', 1]]),
        gameNames: new Map([
          ['g-a', { gameId: 'roulette', name: 'Roulette' }],
          ['g-b', { gameId: 'skyfall', name: 'SKYFALL' }],
        ]),
      };
      const stats = await service.getPlayerStats('user-1', {});

      assert.equal(stats.totalGames, 10);
      assert.equal(stats.wins, 3);
      assert.equal(stats.losses, 5);
      assert.equal(stats.even, 2);
      assert.equal(stats.inProgress, 2);
      assert.equal(stats.wagered, 1000);
      assert.equal(stats.winnings, 900);
      assert.equal(stats.net, -100);
      assert.equal(stats.winRate, 0.3);
      assert.equal(stats.averageStake, 100);
      assert.equal(stats.biggestPayout, 400);
      assert.deepEqual(stats.perGame[0], {
        gameId: 'roulette',
        gameName: 'Roulette',
        games: 7,
        wins: 2,
        losses: 4,
        even: 1,
        wagered: 700,
        winnings: 500,
        net: -200,
      });
    });

    it('handles a player with no games (no division by zero)', async () => {
      repository.stats = emptyRaw();
      const stats = await service.getPlayerStats('user-1', {});
      assert.equal(stats.totalGames, 0);
      assert.equal(stats.winRate, 0);
      assert.equal(stats.averageStake, 0);
      assert.deepEqual(stats.perGame, []);
    });
  });
});

function emptyRaw(): StatsRaw {
  return {
    settled: { count: 0, wagered: D(0), winnings: D(0), biggestPayout: D(0) },
    inProgress: 0,
    wins: 0,
    losses: 0,
    perGame: [],
    perGameWins: new Map(),
    perGameLosses: new Map(),
    gameNames: new Map(),
  };
}
