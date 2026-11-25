import { Injectable } from '@nestjs/common';
import { AdminWalletService } from '../demo-wallet/admin-wallet.service';
import { AdminListWalletTransactionsQueryDto } from '../demo-wallet/dto/list-wallet-transactions-query.dto';
import { GameHistoryService } from '../game-history/game-history.service';
import { ListGameHistoryQueryDto } from '../game-history/dto/game-history-queries.dto';
import { GamesService } from '../games/games.service';
import { UsersService } from '../users/users.service';
import { DASHBOARD_RECENT_LIMIT, USER_OVERVIEW_RECENT_LIMIT } from './constants/admin-dashboard.constants';
import { DashboardOverview, UserOverview } from './interfaces/admin-dashboard.interface';

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * The admin dashboard only COMBINES what the existing modules already know (users, catalog, game history,
 * wallet ledger). It owns no data and does no calculations of its own beyond simple sums, so the numbers always
 * agree with those modules.
 */
@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly usersService: UsersService,
    private readonly gamesService: GamesService,
    private readonly historyService: GameHistoryService,
    private readonly adminWalletService: AdminWalletService,
  ) {}

  async getOverview(): Promise<DashboardOverview> {
    const [users, games, play, walletStats, platformStats, recentUsers, recentRounds, recentTransactions] =
      await Promise.all([
        this.usersService.getCounts(),
        this.gamesService.getCounts(),
        this.historyService.getPlayTotals(),
        this.adminWalletService.getStats({}),
        this.historyService.getAdminStats({}),
        this.usersService.listRecent(DASHBOARD_RECENT_LIMIT),
        this.historyService.listRecentActivity(DASHBOARD_RECENT_LIMIT),
        this.adminWalletService.listTransactions(this.transactionQuery(DASHBOARD_RECENT_LIMIT)),
      ]);

    return {
      generatedAt: new Date(),
      users: {
        total: users.total,
        active: users.active,
        suspended: users.total - users.active,
        byRole: users.byRole,
        registeredLast7Days: users.registeredLast7Days,
        registeredLast30Days: users.registeredLast30Days,
      },
      games: {
        registered: games.total,
        installed: games.installed,
        published: games.published,
        unpublished: games.total - games.published,
        disabled: games.byStatus['DISABLED'] ?? 0,
        byStatus: games.byStatus,
      },
      play: {
        totalSessions: play.sessions.total,
        activeSessions: play.sessions.active,
        completedRounds: play.rounds.settled,
        roundsInProgress: play.rounds.inProgress,
        totalWagered: play.wagered,
        totalWinnings: play.winnings,
        net: round2(play.winnings - play.wagered),
      },
      wallet: {
        creditsInCirculation: walletStats.totalBalance,
        totalCredited: walletStats.totalCredited,
        totalDebited: walletStats.totalDebited,
        discrepancy: walletStats.discrepancy,
        ledgerBalanced: walletStats.discrepancy === 0,
        wallets: walletStats.wallets,
      },
      gameActivity: platformStats.perGame,
      recent: {
        registrations: recentUsers.map(({ id, name, email, role, isActive, createdAt }) => ({
          id,
          name,
          email,
          role,
          isActive,
          createdAt,
        })),
        gameActivity: recentRounds,
        walletTransactions: recentTransactions.items,
      },
    };
  }

  /** Everything about one player in one call: account, wallet, play activity and recent items. */
  async getUserOverview(userId: string): Promise<UserOverview> {
    const user = await this.usersService.getById(userId); // 404 for an unknown user

    const [wallet, activity, stats, recentRounds, recentTransactions] = await Promise.all([
      this.adminWalletService.findWallet(userId),
      this.historyService.getUserActivityInfo(userId),
      this.historyService.getUserStats(userId),
      this.historyService.listForUser(userId, this.historyQuery(USER_OVERVIEW_RECENT_LIMIT)),
      this.adminWalletService.listTransactions(this.transactionQuery(USER_OVERVIEW_RECENT_LIMIT, userId)),
    ]);

    return {
      user,
      registration: {
        registeredAt: user.createdAt,
        updatedAt: user.updatedAt,
        accountStatus: user.isActive ? 'ACTIVE' : 'SUSPENDED',
      },
      wallet,
      activity: { ...activity, stats },
      recentRounds: recentRounds.items,
      recentTransactions: recentTransactions.items,
    };
  }

  private transactionQuery(limit: number, userId?: string): AdminListWalletTransactionsQueryDto {
    return Object.assign(new AdminListWalletTransactionsQueryDto(), { page: 1, limit, userId });
  }

  private historyQuery(limit: number): ListGameHistoryQueryDto {
    return Object.assign(new ListGameHistoryQueryDto(), { page: 1, limit });
  }
}
