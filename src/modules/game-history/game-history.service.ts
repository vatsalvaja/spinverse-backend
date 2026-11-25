import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SortOrder } from '../../common/enums/sort-order.enum';
import { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { buildPaginatedResult, toSkipTake } from '../../common/utils/pagination.util';
import { DemoWalletService } from '../demo-wallet/demo-wallet.service';
import { GamesRepository } from '../games/games.repository';
import { UsersService } from '../users/users.service';
import { HISTORY_ERRORS } from './constants/game-history.constants';
import {
  AdminGameHistoryStatsQueryDto,
  AdminListGameHistoryQueryDto,
  GameHistoryStatsQueryDto,
  ListGameHistoryQueryDto,
  UserActivityQueryDto,
} from './dto/game-history-queries.dto';
import { GameHistorySortField } from './enums/game-history-sort-field.enum';
import { GameHistoryRepository } from './game-history.repository';
import {
  DailyActivityRow,
  GameReportRow,
  HistoryFilter,
  HistoryStats,
  PlayTotals,
  RoundHistoryDetail,
  RoundHistoryItem,
  UserActivityRow,
  UserSummary,
} from './interfaces/game-history.interface';
import { toHistoryDetail, toHistoryItem } from './mappers/game-history.mapper';

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * One central game history for every game. It only READS the authoritative records the game runtime wrote
 * (rounds) and the wallet ledger (credit movements): history never recalculates a result or a payout, and it
 * keeps no separate per-game storage.
 */
@Injectable()
export class GameHistoryService {
  constructor(
    private readonly historyRepository: GameHistoryRepository,
    private readonly gamesRepository: GamesRepository,
    private readonly walletService: DemoWalletService,
    private readonly usersService: UsersService,
  ) {}

  // --- player (always scoped to the signed-in user) --------------------------------

  listForPlayer(userId: string, query: ListGameHistoryQueryDto): Promise<PaginatedResult<RoundHistoryItem>> {
    return this.list({ userId }, query, false);
  }

  /** History of one game (`gameSlug` is the public game id). */
  async listForPlayerGame(
    userId: string,
    gameSlug: string,
    query: ListGameHistoryQueryDto,
  ): Promise<PaginatedResult<RoundHistoryItem>> {
    const slug = await this.requireGame(gameSlug);
    return this.list({ userId }, { ...query, gameId: slug }, false);
  }

  /** One of the player's own rounds with every wallet entry it caused. */
  getPlayerDetail(userId: string, roundId: string): Promise<RoundHistoryDetail> {
    return this.getDetail(roundId, userId, false);
  }

  getPlayerStats(userId: string, query: GameHistoryStatsQueryDto): Promise<HistoryStats> {
    return this.stats({ userId }, query);
  }

  // --- admin ---------------------------------------------------------------------

  listAll(query: AdminListGameHistoryQueryDto): Promise<PaginatedResult<RoundHistoryItem>> {
    return this.list({ userId: query.userId }, query, true);
  }

  async listForUser(userId: string, query: ListGameHistoryQueryDto): Promise<PaginatedResult<RoundHistoryItem>> {
    await this.usersService.getById(userId); // 404 for an unknown user
    return this.list({ userId }, query, true);
  }

  async listForGame(gameSlug: string, query: AdminListGameHistoryQueryDto): Promise<PaginatedResult<RoundHistoryItem>> {
    const slug = await this.requireGame(gameSlug);
    return this.list({ userId: query.userId }, { ...query, gameId: slug }, true);
  }

  getAdminDetail(roundId: string): Promise<RoundHistoryDetail> {
    return this.getDetail(roundId, undefined, true);
  }

  getAdminStats(query: AdminGameHistoryStatsQueryDto): Promise<HistoryStats> {
    return this.stats({ userId: query.userId }, query);
  }

  /** Player statistics for any user (admin dashboards). */
  getUserStats(userId: string, query: GameHistoryStatsQueryDto = {}): Promise<HistoryStats> {
    return this.stats({ userId }, query);
  }

  /** The newest rounds across all players, with player names (dashboard). */
  async listRecentActivity(limit: number): Promise<RoundHistoryItem[]> {
    const { items } = await this.historyRepository.findMany({
      filter: {},
      sort: { field: GameHistorySortField.StartedAt, order: SortOrder.Desc },
      skip: 0,
      take: limit,
    });
    return this.withUsers(items.map((row) => toHistoryItem(row)));
  }

  // --- totals and reports (admin dashboard) --------------------------------------------

  getPlayTotals(): Promise<PlayTotals> {
    return this.historyRepository.getPlayTotals();
  }

  getUserActivityInfo(userId: string) {
    return this.historyRepository.getUserActivityInfo(userId);
  }

  /** Rounds, players, credits and observed return per game (optionally within a date range). */
  async getGameReport(range: { from?: Date; to?: Date }): Promise<GameReportRow[]> {
    this.assertRange(range.from, range.to);
    const [rows, refunds] = await Promise.all([
      this.historyRepository.reportByGame(range),
      this.historyRepository.countRefundedRoundsByGame(range),
    ]);
    const names = await this.historyRepository.findGameNamesById(rows.map((row) => row.gameRowId));

    return rows
      .map((row) => {
        const game = names.get(row.gameRowId);
        return {
          gameId: game?.gameId ?? row.gameRowId,
          gameName: game?.name ?? '',
          rounds: row.rounds,
          settled: row.settled,
          inProgress: row.inProgress,
          refunded: refunds.get(row.gameRowId) ?? 0,
          players: row.players,
          wins: row.wins,
          wagered: row.wagered,
          winnings: row.winnings,
          net: round2(row.winnings - row.wagered),
          observedReturnPercent: row.wagered > 0 ? round2((row.winnings / row.wagered) * 100) : null,
        };
      })
      .sort((a, b) => b.rounds - a.rounds);
  }

  /** Rounds, active players and credits per day (UTC), optionally for one game. */
  async getDailyActivity(range: { from?: Date; to?: Date }, gameSlug?: string): Promise<DailyActivityRow[]> {
    this.assertRange(range.from, range.to);
    let gameRowId: string | undefined;
    if (gameSlug) {
      const game = await this.gamesRepository.findByGameId(gameSlug.toLowerCase());
      if (!game) throw new NotFoundException(HISTORY_ERRORS.GAME_NOT_FOUND);
      gameRowId = game.id;
    }
    const rows = await this.historyRepository.dailyActivity(range, gameRowId);
    return rows.map((row) => ({
      date: row.date,
      rounds: row.rounds,
      activePlayers: row.players,
      wagered: row.wagered,
      winnings: row.winnings,
      net: round2(row.winnings - row.wagered),
    }));
  }

  /** The most active players, with names. */
  async getUserActivityReport(query: UserActivityQueryDto): Promise<UserActivityRow[]> {
    this.assertRange(query.from, query.to);
    const rows = await this.historyRepository.userActivity({
      range: { from: query.from, to: query.to },
      sortBy: query.sortBy,
      limit: query.limit,
    });
    const users = await this.usersService.findSummaries(rows.map((row) => row.userId));
    const byId = new Map(users.map((user) => [user.id, user]));
    return rows.map((row) => ({
      userId: row.userId,
      user: byId.get(row.userId),
      rounds: row.rounds,
      wagered: row.wagered,
      winnings: row.winnings,
      net: round2(row.winnings - row.wagered),
      lastActiveAt: row.lastActiveAt,
    }));
  }

  // --- shared ----------------------------------------------------------------------

  private async list(
    base: Pick<HistoryFilter, 'userId'>,
    query: ListGameHistoryQueryDto,
    withUserNames: boolean,
  ): Promise<PaginatedResult<RoundHistoryItem>> {
    this.assertRange(query.from, query.to);

    let gameRowId: string | undefined;
    if (query.gameId) {
      const game = await this.gamesRepository.findByGameId(query.gameId);
      // A filter on a game that does not exist can match nothing.
      if (!game) return buildPaginatedResult([], 0, query.page, query.limit);
      gameRowId = game.id;
    }

    const { items, total } = await this.historyRepository.findMany({
      filter: { ...base, gameRowId, status: query.status, outcome: query.outcome, from: query.from, to: query.to },
      sort: { field: query.sortBy, order: query.sortOrder },
      ...toSkipTake(query.page, query.limit),
    });

    const views = items.map((row) => toHistoryItem(row));
    return buildPaginatedResult(withUserNames ? await this.withUsers(views) : views, total, query.page, query.limit);
  }

  private async getDetail(roundId: string, userId: string | undefined, admin: boolean): Promise<RoundHistoryDetail> {
    const row = await this.historyRepository.findDetail(roundId, userId);
    if (!row) throw new NotFoundException(HISTORY_ERRORS.ROUND_NOT_FOUND);

    const transactions = await this.walletService.getRoundTransactions(row.id, admin);
    const user = admin ? (await this.usersService.findSummaries([row.userId]))[0] : undefined;
    return toHistoryDetail(row, transactions, user);
  }

  private async stats(base: Pick<HistoryFilter, 'userId'>, query: GameHistoryStatsQueryDto): Promise<HistoryStats> {
    this.assertRange(query.from, query.to);

    let gameRowId: string | undefined;
    if (query.gameId) {
      const game = await this.gamesRepository.findByGameId(query.gameId);
      if (!game) return this.emptyStats(query);
      gameRowId = game.id;
    }

    const raw = await this.historyRepository.getStatsRaw({ ...base, gameRowId, from: query.from, to: query.to });
    const total = raw.settled.count;
    const wagered = raw.settled.wagered.toNumber();
    const winnings = raw.settled.winnings.toNumber();

    return {
      totalGames: total,
      wins: raw.wins,
      losses: raw.losses,
      even: total - raw.wins - raw.losses,
      inProgress: raw.inProgress,
      wagered,
      winnings,
      net: round2(winnings - wagered),
      winRate: total > 0 ? Math.round((raw.wins / total) * 10_000) / 10_000 : 0,
      averageStake: total > 0 ? round2(wagered / total) : 0,
      biggestPayout: raw.settled.biggestPayout.toNumber(),
      perGame: raw.perGame
        .map((group) => {
          const wins = raw.perGameWins.get(group.gameRowId) ?? 0;
          const losses = raw.perGameLosses.get(group.gameRowId) ?? 0;
          const names = raw.gameNames.get(group.gameRowId);
          const groupWagered = group.wagered.toNumber();
          const groupWinnings = group.winnings.toNumber();
          return {
            gameId: names?.gameId ?? group.gameRowId,
            gameName: names?.name ?? '',
            games: group.games,
            wins,
            losses,
            even: group.games - wins - losses,
            wagered: groupWagered,
            winnings: groupWinnings,
            net: round2(groupWinnings - groupWagered),
          };
        })
        .sort((a, b) => b.games - a.games),
      range: { from: query.from ?? null, to: query.to ?? null },
    };
  }

  private emptyStats(query: GameHistoryStatsQueryDto): HistoryStats {
    return {
      totalGames: 0,
      wins: 0,
      losses: 0,
      even: 0,
      inProgress: 0,
      wagered: 0,
      winnings: 0,
      net: 0,
      winRate: 0,
      averageStake: 0,
      biggestPayout: 0,
      perGame: [],
      range: { from: query.from ?? null, to: query.to ?? null },
    };
  }

  /** Adds the player's name and e-mail to each row (one lookup for the whole page). */
  async withUsers<T extends { userId: string; user?: UserSummary }>(items: T[]): Promise<T[]> {
    const summaries = await this.usersService.findSummaries(items.map((item) => item.userId));
    const byId = new Map(summaries.map((summary) => [summary.id, summary]));
    return items.map((item) => ({ ...item, user: byId.get(item.userId) }));
  }

  /** Returns the normalised public game id, or 404 when no such game exists. */
  private async requireGame(gameSlug: string): Promise<string> {
    const slug = gameSlug.toLowerCase();
    if (!(await this.gamesRepository.findByGameId(slug))) throw new NotFoundException(HISTORY_ERRORS.GAME_NOT_FOUND);
    return slug;
  }

  private assertRange(from?: Date, to?: Date): void {
    if (from && to && from.getTime() > to.getTime()) throw new BadRequestException(HISTORY_ERRORS.INVALID_RANGE);
  }
}
