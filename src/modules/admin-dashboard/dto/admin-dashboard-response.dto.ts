import { ApiProperty } from '@nestjs/swagger';
import { AdminWalletResponseDto, TransactionResponseDto } from '../../demo-wallet/dto/wallet-response.dto';
import { GameBreakdownDto, HistoryStatsDto, RoundHistoryItemDto } from '../../game-history/dto/game-history-response.dto';
import { UserResponseDto } from '../../users/dto/user-response.dto';

class DashboardUsersDto {
  @ApiProperty() total: number;
  @ApiProperty() active: number;
  @ApiProperty({ description: 'Deactivated accounts (cannot log in or play)' }) suspended: number;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' }, example: { USER: 40, ADMIN: 2 } }) byRole: Record<string, number>;
  @ApiProperty() registeredLast7Days: number;
  @ApiProperty() registeredLast30Days: number;
}

class DashboardGamesDto {
  @ApiProperty() registered: number;
  @ApiProperty({ description: 'Games with a package installed on the server' }) installed: number;
  @ApiProperty() published: number;
  @ApiProperty() unpublished: number;
  @ApiProperty() disabled: number;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' }, example: { ACTIVE: 6 } }) byStatus: Record<string, number>;
}

class DashboardPlayDto {
  @ApiProperty() totalSessions: number;
  @ApiProperty() activeSessions: number;
  @ApiProperty({ description: 'Settled rounds' }) completedRounds: number;
  @ApiProperty() roundsInProgress: number;
  @ApiProperty({ description: 'Demo credits wagered in settled rounds' }) totalWagered: number;
  @ApiProperty({ description: 'Demo credits paid out in settled rounds' }) totalWinnings: number;
  @ApiProperty({ description: 'totalWinnings - totalWagered' }) net: number;
}

class WalletCountsDto {
  @ApiProperty() total: number;
  @ApiProperty() active: number;
  @ApiProperty() suspended: number;
}

class DashboardWalletDto {
  @ApiProperty({ description: 'Demo credits currently held in all wallets' }) creditsInCirculation: number;
  @ApiProperty() totalCredited: number;
  @ApiProperty() totalDebited: number;
  @ApiProperty({ description: 'totalCredited - totalDebited - creditsInCirculation' }) discrepancy: number;
  @ApiProperty({ description: 'True when the books balance' }) ledgerBalanced: boolean;
  @ApiProperty({ type: WalletCountsDto }) wallets: WalletCountsDto;
}

class RecentRegistrationDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty() role: string;
  @ApiProperty() isActive: boolean;
  @ApiProperty() createdAt: Date;
}

class DashboardRecentDto {
  @ApiProperty({ type: [RecentRegistrationDto] }) registrations: RecentRegistrationDto[];
  @ApiProperty({ type: [RoundHistoryItemDto] }) gameActivity: RoundHistoryItemDto[];
  @ApiProperty({ type: [TransactionResponseDto] }) walletTransactions: TransactionResponseDto[];
}

export class DashboardOverviewDto {
  @ApiProperty() generatedAt: Date;
  @ApiProperty({ type: DashboardUsersDto }) users: DashboardUsersDto;
  @ApiProperty({ type: DashboardGamesDto }) games: DashboardGamesDto;
  @ApiProperty({ type: DashboardPlayDto }) play: DashboardPlayDto;
  @ApiProperty({ type: DashboardWalletDto }) wallet: DashboardWalletDto;
  @ApiProperty({ type: [GameBreakdownDto], description: 'Per-game activity (settled rounds)' }) gameActivity: GameBreakdownDto[];
  @ApiProperty({ type: DashboardRecentDto }) recent: DashboardRecentDto;
}

class UserRegistrationDto {
  @ApiProperty() registeredAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED'] }) accountStatus: string;
}

class UserActivityInfoDto {
  @ApiProperty() sessions: number;
  @ApiProperty() rounds: number;
  @ApiProperty({ type: Date, nullable: true }) firstRoundAt: Date | null;
  @ApiProperty({ type: Date, nullable: true }) lastRoundAt: Date | null;
  @ApiProperty({ type: HistoryStatsDto }) stats: HistoryStatsDto;
}

export class UserOverviewDto {
  @ApiProperty({ type: UserResponseDto }) user: UserResponseDto;
  @ApiProperty({ type: UserRegistrationDto }) registration: UserRegistrationDto;
  @ApiProperty({ type: AdminWalletResponseDto, nullable: true, description: 'null when the player has no wallet yet' }) wallet: AdminWalletResponseDto | null;
  @ApiProperty({ type: UserActivityInfoDto }) activity: UserActivityInfoDto;
  @ApiProperty({ type: [RoundHistoryItemDto] }) recentRounds: RoundHistoryItemDto[];
  @ApiProperty({ type: [TransactionResponseDto] }) recentTransactions: TransactionResponseDto[];
}

export class GameReportRowDto {
  @ApiProperty({ example: 'skyfall' }) gameId: string;
  @ApiProperty() gameName: string;
  @ApiProperty({ description: 'All rounds started' }) rounds: number;
  @ApiProperty({ description: 'Completed rounds' }) settled: number;
  @ApiProperty() inProgress: number;
  @ApiProperty({ description: 'Rounds whose entry was refunded (a failed or cancelled round is never stored: it is rolled back)' }) refunded: number;
  @ApiProperty({ description: 'Different players' }) players: number;
  @ApiProperty() wins: number;
  @ApiProperty() wagered: number;
  @ApiProperty() winnings: number;
  @ApiProperty() net: number;
  @ApiProperty({ type: Number, nullable: true, description: 'winnings / wagered as a percentage' }) observedReturnPercent: number | null;
}

export class DailyReportRowDto {
  @ApiProperty({ example: '2026-11-29', description: 'UTC date' }) date: string;
  @ApiProperty() rounds: number;
  @ApiProperty() activePlayers: number;
  @ApiProperty() wagered: number;
  @ApiProperty() winnings: number;
  @ApiProperty() net: number;
  @ApiProperty() newUsers: number;
  @ApiProperty({ description: 'Demo credits added to wallets that day' }) walletCredited: number;
  @ApiProperty({ description: 'Demo credits taken from wallets that day' }) walletDebited: number;
}

class UserSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
}

export class UserActivityRowDto {
  @ApiProperty() userId: string;
  @ApiProperty({ type: UserSummaryDto, required: false }) user?: UserSummaryDto;
  @ApiProperty() rounds: number;
  @ApiProperty() wagered: number;
  @ApiProperty() winnings: number;
  @ApiProperty() net: number;
  @ApiProperty({ type: Date, nullable: true }) lastActiveAt: Date | null;
}
