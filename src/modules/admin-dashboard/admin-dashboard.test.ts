import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminWalletService } from '../demo-wallet/admin-wallet.service';
import { GameHistoryService } from '../game-history/game-history.service';
import { GamesService } from '../games/games.service';
import { UsersService } from '../users/users.service';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminReportsService } from './admin-reports.service';
import { DailyReportQueryDto } from './dto/admin-report-queries.dto';

const user = (id: string, isActive = true) => ({
  id,
  name: `User ${id}`,
  email: `${id}@example.com`,
  role: 'USER',
  isActive,
  createdAt: new Date('2026-11-01'),
  updatedAt: new Date('2026-11-02'),
});

const walletStats = (discrepancy = 0) => ({
  wallets: { total: 5, active: 4, suspended: 1 },
  totalBalance: 24_000,
  totalCredited: 30_000,
  totalDebited: 6_000 - discrepancy,
  discrepancy,
  byType: [],
  range: { from: null, to: null },
});

function makeDashboard(overrides: { walletStats?: ReturnType<typeof walletStats>; knownUser?: boolean } = {}) {
  const calls: Record<string, unknown[]> = { transactions: [], history: [] };
  const service = new AdminDashboardService(
    {
      getCounts: async () => ({ total: 10, active: 8, byRole: { USER: 9, ADMIN: 1 }, registeredLast7Days: 3, registeredLast30Days: 6 }),
      listRecent: async () => [user('a'), user('b')],
      getById: async (id: string) => {
        if (overrides.knownUser === false) throw new NotFoundException('User not found');
        return user(id, false);
      },
    } as unknown as UsersService,
    {
      getCounts: async () => ({ total: 6, byStatus: { ACTIVE: 4, DISABLED: 1, DRAFT: 1 }, installed: 5, published: 3 }),
    } as unknown as GamesService,
    {
      getPlayTotals: async () => ({ sessions: { total: 20, active: 4 }, rounds: { settled: 200, inProgress: 2 }, wagered: 10_000, winnings: 9_400.5 }),
      getAdminStats: async () => ({ perGame: [{ gameId: 'roulette', gameName: 'Roulette', games: 5, wins: 2, losses: 3, even: 0, wagered: 100, winnings: 80, net: -20 }] }),
      listRecentActivity: async (limit: number) => {
        calls.history.push(limit);
        return [{ id: 'r1' }];
      },
      getUserActivityInfo: async () => ({ sessions: 2, rounds: 9, firstRoundAt: new Date('2026-11-02'), lastRoundAt: new Date('2026-11-20') }),
      getUserStats: async () => ({ totalGames: 9 }),
      listForUser: async () => ({ items: [{ id: 'r9' }], meta: {} }),
    } as unknown as GameHistoryService,
    {
      getStats: async () => overrides.walletStats ?? walletStats(),
      listTransactions: async (query: { limit: number; userId?: string }) => {
        calls.transactions.push(query);
        return { items: [{ id: 't1' }], meta: {} };
      },
      findWallet: async () => null,
    } as unknown as AdminWalletService,
  );
  return { service, calls };
}

describe('AdminDashboardService', () => {
  it('combines users, games, play and wallet figures from the existing modules', async () => {
    const { service } = makeDashboard();
    const overview = await service.getOverview();

    assert.equal(overview.users.total, 10);
    assert.equal(overview.users.active, 8);
    assert.equal(overview.users.suspended, 2);
    assert.deepEqual(overview.games, {
      registered: 6,
      installed: 5,
      published: 3,
      unpublished: 3,
      disabled: 1,
      byStatus: { ACTIVE: 4, DISABLED: 1, DRAFT: 1 },
    });
    assert.equal(overview.play.completedRounds, 200);
    assert.equal(overview.play.net, -599.5);
    assert.equal(overview.wallet.creditsInCirculation, 24_000);
    assert.equal(overview.gameActivity[0].gameId, 'roulette');
    assert.equal(overview.recent.registrations.length, 2);
    assert.equal(overview.recent.gameActivity.length, 1);
    assert.equal(overview.recent.walletTransactions.length, 1);
  });

  it('never exposes more than id, name, e-mail, role, status and date for recent registrations', async () => {
    const { service } = makeDashboard();
    const [first] = (await service.getOverview()).recent.registrations;
    assert.deepEqual(Object.keys(first).sort(), ['createdAt', 'email', 'id', 'isActive', 'name', 'role']);
  });

  it('reports whether the ledger balances', async () => {
    assert.equal((await makeDashboard().service.getOverview()).wallet.ledgerBalanced, true);
    const broken = await makeDashboard({ walletStats: walletStats(12.5) }).service.getOverview();
    assert.equal(broken.wallet.ledgerBalanced, false);
    assert.equal(broken.wallet.discrepancy, 12.5);
  });

  describe('user overview', () => {
    it('shows registration, a suspended account, no wallet yet, activity and recent items', async () => {
      const { service, calls } = makeDashboard();
      const overview = await service.getUserOverview('u1');

      assert.equal(overview.registration.accountStatus, 'SUSPENDED');
      assert.equal(overview.registration.registeredAt.toISOString(), '2026-11-01T00:00:00.000Z');
      assert.equal(overview.wallet, null);
      assert.equal(overview.activity.rounds, 9);
      assert.equal(overview.recentRounds.length, 1);
      assert.equal((calls.transactions[0] as { userId: string }).userId, 'u1', 'only this player\'s transactions');
    });

    it('is a 404 for an unknown user', async () => {
      await assert.rejects(makeDashboard({ knownUser: false }).service.getUserOverview('nobody'), NotFoundException);
    });
  });
});

describe('AdminReportsService daily report', () => {
  let ranges: { from?: Date; to?: Date }[];
  let service: AdminReportsService;

  beforeEach(() => {
    ranges = [];
    service = new AdminReportsService(
      {
        getDailyActivity: async (range: { from?: Date; to?: Date }) => {
          ranges.push(range);
          return [
            { date: '2026-11-02', rounds: 10, activePlayers: 3, wagered: 100, winnings: 90, net: -10 },
            { date: '2026-11-01', rounds: 4, activePlayers: 2, wagered: 40, winnings: 50, net: 10 },
          ];
        },
      } as unknown as GameHistoryService,
      { registrationsByDay: async () => [{ date: '2026-11-01', count: 5 }, { date: '2026-11-03', count: 1 }] } as unknown as UsersService,
      { getDailyTotals: async () => [{ date: '2026-11-02', credited: 500, debited: 120, transactions: 9 }] } as unknown as AdminWalletService,
    );
  });

  const query = (overrides: Partial<DailyReportQueryDto> = {}) => Object.assign(new DailyReportQueryDto(), overrides);

  it('merges rounds, registrations and wallet totals into one row per day, in date order', async () => {
    const rows = await service.getDailyReport(query({ from: new Date('2026-11-01'), to: new Date('2026-11-05') }));

    assert.deepEqual(rows.map((r) => r.date), ['2026-11-01', '2026-11-02', '2026-11-03']);
    assert.deepEqual(rows[0], { date: '2026-11-01', rounds: 4, activePlayers: 2, wagered: 40, winnings: 50, net: 10, newUsers: 5, walletCredited: 0, walletDebited: 0 });
    assert.equal(rows[1].walletCredited, 500);
    assert.equal(rows[1].walletDebited, 120);
    assert.deepEqual([rows[2].rounds, rows[2].newUsers], [0, 1], 'a day with only registrations still appears');
  });

  it('defaults to the last 30 days', async () => {
    const now = new Date('2026-11-30T12:00:00.000Z');
    await service.getDailyReport(query(), now);
    const [range] = ranges;
    assert.equal(range.to?.toISOString(), now.toISOString());
    assert.equal(Math.round((now.getTime() - (range.from as Date).getTime()) / 86_400_000), 30);
  });

  it('refuses a range longer than 366 days', async () => {
    await assert.rejects(
      service.getDailyReport(query({ from: new Date('2025-01-01'), to: new Date('2026-11-30') })),
      BadRequestException,
    );
  });
});
