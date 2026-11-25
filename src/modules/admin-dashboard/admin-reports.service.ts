import { BadRequestException, Injectable } from '@nestjs/common';
import { AdminWalletService } from '../demo-wallet/admin-wallet.service';
import { UserActivityQueryDto } from '../game-history/dto/game-history-queries.dto';
import { GameHistoryService } from '../game-history/game-history.service';
import {
  GameReportRow,
  UserActivityRow,
} from '../game-history/interfaces/game-history.interface';
import { UsersService } from '../users/users.service';
import {
  DASHBOARD_ERRORS,
  DEFAULT_REPORT_DAYS,
  MAX_REPORT_DAYS,
} from './constants/admin-dashboard.constants';
import { DailyReportQueryDto } from './dto/admin-report-queries.dto';
import { DailyReportRow } from './interfaces/admin-dashboard.interface';

const DAY_MS = 86_400_000;
const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Reports over the authoritative records of the game history and the wallet ledger. */
@Injectable()
export class AdminReportsService {
  constructor(
    private readonly historyService: GameHistoryService,
    private readonly usersService: UsersService,
    private readonly adminWalletService: AdminWalletService,
  ) {}

  /** Rounds by game: completed / in progress / refunded, players, credits wagered and won, observed return. */
  getGameReport(range: { from?: Date; to?: Date }): Promise<GameReportRow[]> {
    return this.historyService.getGameReport(range);
  }

  getUserActivity(query: UserActivityQueryDto): Promise<UserActivityRow[]> {
    return this.historyService.getUserActivityReport(query);
  }

  /**
   * Day-by-day figures (UTC): rounds, active players, credits wagered and won, new registrations and wallet
   * credits / debits. Defaults to the last 30 days; at most 366 days at a time.
   */
  async getDailyReport(query: DailyReportQueryDto, now: Date = new Date()): Promise<DailyReportRow[]> {
    const to = query.to ?? now;
    const from = query.from ?? new Date(to.getTime() - DEFAULT_REPORT_DAYS * DAY_MS);
    if (to.getTime() - from.getTime() > MAX_REPORT_DAYS * DAY_MS) {
      throw new BadRequestException(DASHBOARD_ERRORS.RANGE_TOO_LONG);
    }
    const range = { from, to };

    const [rounds, registrations, wallet] = await Promise.all([
      this.historyService.getDailyActivity(range, query.gameId),
      this.usersService.registrationsByDay(range),
      this.adminWalletService.getDailyTotals(range),
    ]);

    const days = new Map<string, DailyReportRow>();
    const row = (date: string): DailyReportRow => {
      let entry = days.get(date);
      if (!entry) {
        entry = { date, rounds: 0, activePlayers: 0, wagered: 0, winnings: 0, net: 0, newUsers: 0, walletCredited: 0, walletDebited: 0 };
        days.set(date, entry);
      }
      return entry;
    };

    for (const item of rounds) Object.assign(row(item.date), item);
    for (const item of registrations) row(item.date).newUsers = item.count;
    for (const item of wallet) {
      const entry = row(item.date);
      entry.walletCredited = item.credited;
      entry.walletDebited = item.debited;
    }

    return Array.from(days.values())
      .map((entry) => ({ ...entry, net: round2(entry.winnings - entry.wagered) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}
