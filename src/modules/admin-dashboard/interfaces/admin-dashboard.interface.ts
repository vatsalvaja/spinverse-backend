import { AdminWalletView, TransactionView } from '../../demo-wallet/interfaces/demo-wallet.interface';
import {
  GameBreakdown,
  HistoryStats,
  RoundHistoryItem,
} from '../../game-history/interfaces/game-history.interface';
import { SafeUser } from '../../users/interfaces/user.interface';

export interface DashboardOverview {
  generatedAt: Date;
  users: {
    total: number;
    active: number;
    /** Deactivated accounts (they cannot log in or play). */
    suspended: number;
    byRole: Record<string, number>;
    registeredLast7Days: number;
    registeredLast30Days: number;
  };
  games: {
    registered: number;
    /** Games with a package installed on the server. */
    installed: number;
    published: number;
    unpublished: number;
    disabled: number;
    byStatus: Record<string, number>;
  };
  play: {
    totalSessions: number;
    activeSessions: number;
    /** Settled rounds. */
    completedRounds: number;
    roundsInProgress: number;
    totalWagered: number;
    totalWinnings: number;
    net: number;
  };
  wallet: {
    /** Demo credits currently held in all wallets. */
    creditsInCirculation: number;
    totalCredited: number;
    totalDebited: number;
    /** totalCredited - totalDebited - creditsInCirculation. */
    discrepancy: number;
    /** True when the books balance (discrepancy is 0). */
    ledgerBalanced: boolean;
    wallets: { total: number; active: number; suspended: number };
  };
  /** Per-game activity (settled rounds). */
  gameActivity: GameBreakdown[];
  recent: {
    registrations: Pick<SafeUser, 'id' | 'name' | 'email' | 'role' | 'isActive' | 'createdAt'>[];
    gameActivity: RoundHistoryItem[];
    walletTransactions: TransactionView[];
  };
}

export interface UserOverview {
  user: SafeUser;
  registration: { registeredAt: Date; updatedAt: Date; accountStatus: 'ACTIVE' | 'SUSPENDED' };
  /** null when the player has not opened a wallet yet. */
  wallet: AdminWalletView | null;
  activity: {
    sessions: number;
    rounds: number;
    firstRoundAt: Date | null;
    lastRoundAt: Date | null;
    stats: HistoryStats;
  };
  recentRounds: RoundHistoryItem[];
  recentTransactions: TransactionView[];
}

export interface DailyReportRow {
  /** YYYY-MM-DD (UTC). */
  date: string;
  rounds: number;
  activePlayers: number;
  wagered: number;
  winnings: number;
  net: number;
  newUsers: number;
  walletCredited: number;
  walletDebited: number;
}
