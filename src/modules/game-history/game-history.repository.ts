import { Injectable } from '@nestjs/common';
import { GameRoundStatus, GameSessionStatus, Prisma } from '@prisma/client';
import { SortParams } from '../../common/interfaces/pagination.interface';
import { toSortDirection } from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma.service';
import { GameHistorySortField } from './enums/game-history-sort-field.enum';
import { RoundOutcome } from './enums/round-outcome.enum';
import { UserActivitySortField } from './enums/user-activity-sort-field.enum';
import {
  HistoryDetailRow,
  HistoryFilter,
  HistoryListRow,
  PlayTotals,
  StatsRaw,
} from './interfaces/game-history.interface';

/** Round columns safe to show in history. The seed, private round state and session state are never selected. */
const LIST_SELECT = {
  id: true,
  sessionId: true,
  userId: true,
  gameId: true,
  roundNumber: true,
  status: true,
  stake: true,
  payout: true,
  balanceBefore: true,
  balanceAfter: true,
  engineVersion: true,
  packageVersion: true,
  startedAt: true,
  settledAt: true,
  game: { select: { gameId: true, name: true } },
} satisfies Prisma.GameRoundSelect;

const DETAIL_SELECT = {
  ...LIST_SELECT,
  bet: true,
  result: true,
  seedCommitment: true,
} satisfies Prisma.GameRoundSelect;

/** The only orderings the user-activity report uses (kept narrow so Prisma's groupBy typing accepts them). */
type ActivityOrder =
  | { _count: { id: 'desc' } }
  | { _sum: { stake: 'desc' } }
  | { _sum: { payout: 'desc' } }
  | { _max: { startedAt: 'desc' } };

export interface RawGameReportRow {
  gameRowId: string;
  rounds: number;
  settled: number;
  inProgress: number;
  players: number;
  wins: number;
  wagered: number;
  winnings: number;
}

export interface RawDailyRow {
  date: string;
  rounds: number;
  players: number;
  wagered: number;
  winnings: number;
}

export interface RawUserActivityRow {
  userId: string;
  rounds: number;
  wagered: number;
  winnings: number;
  lastActiveAt: Date | null;
}

/**
 * Read-only queries over the authoritative round records (`game_rounds`). History is one central system for all
 * games: nothing here knows about a particular game. Rounds are never written here.
 */
@Injectable()
export class GameHistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(params: {
    filter: HistoryFilter;
    sort: SortParams<GameHistorySortField>;
    skip: number;
    take: number;
  }): Promise<{ items: HistoryListRow[]; total: number }> {
    const where = this.buildWhere(params.filter);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.gameRound.findMany({
        where,
        select: LIST_SELECT,
        orderBy: this.buildOrderBy(params.sort),
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.gameRound.count({ where }),
    ]);
    return { items, total };
  }

  /** One round. With `userId`, a round of another player is reported as not found. */
  findDetail(roundId: string, userId?: string): Promise<HistoryDetailRow | null> {
    return this.prisma.gameRound.findFirst({
      where: { id: roundId, ...(userId ? { userId } : {}) },
      select: DETAIL_SELECT,
    });
  }

  /** Counts and sums behind the statistics. Only SETTLED rounds count as games played. */
  async getStatsRaw(filter: HistoryFilter): Promise<StatsRaw> {
    const base = this.buildWhere({ ...filter, status: undefined, outcome: undefined });
    const { stake } = this.prisma.gameRound.fields;
    const settled: Prisma.GameRoundWhereInput = { AND: [base, { status: GameRoundStatus.SETTLED }] };
    const won: Prisma.GameRoundWhereInput = { AND: [settled, { payout: { gt: stake } }] };
    const lost: Prisma.GameRoundWhereInput = { AND: [settled, { payout: { lt: stake } }] };

    const [aggregate, inProgress, wins, losses, perGame, perGameWins, perGameLosses] = await Promise.all([
      this.prisma.gameRound.aggregate({
        where: settled,
        _count: { _all: true },
        _sum: { stake: true, payout: true },
        _max: { payout: true },
      }),
      this.prisma.gameRound.count({ where: { AND: [base, { status: GameRoundStatus.IN_PROGRESS }] } }),
      this.prisma.gameRound.count({ where: won }),
      this.prisma.gameRound.count({ where: lost }),
      this.prisma.gameRound.groupBy({
        by: ['gameId'],
        where: settled,
        _count: { _all: true },
        _sum: { stake: true, payout: true },
        orderBy: { gameId: 'asc' },
      }),
      this.prisma.gameRound.groupBy({ by: ['gameId'], where: won, _count: { _all: true }, orderBy: { gameId: 'asc' } }),
      this.prisma.gameRound.groupBy({ by: ['gameId'], where: lost, _count: { _all: true }, orderBy: { gameId: 'asc' } }),
    ]);

    const zero = new Prisma.Decimal(0);
    const games = await this.findGameNames(perGame.map((row) => row.gameId));

    return {
      settled: {
        count: aggregate._count._all,
        wagered: aggregate._sum.stake ?? zero,
        winnings: aggregate._sum.payout ?? zero,
        biggestPayout: aggregate._max.payout ?? zero,
      },
      inProgress,
      wins,
      losses,
      perGame: perGame.map((row) => ({
        gameRowId: row.gameId,
        games: row._count._all,
        wagered: row._sum.stake ?? zero,
        winnings: row._sum.payout ?? zero,
      })),
      perGameWins: new Map(perGameWins.map((row) => [row.gameId, row._count._all])),
      perGameLosses: new Map(perGameLosses.map((row) => [row.gameId, row._count._all])),
      gameNames: games,
    };
  }

  /** Whole-platform totals for the dashboard. */
  async getPlayTotals(): Promise<PlayTotals> {
    const [sessions, activeSessions, settled, inProgress] = await Promise.all([
      this.prisma.gameSession.count(),
      this.prisma.gameSession.count({ where: { status: GameSessionStatus.ACTIVE } }),
      this.prisma.gameRound.aggregate({
        where: { status: GameRoundStatus.SETTLED },
        _count: { _all: true },
        _sum: { stake: true, payout: true },
      }),
      this.prisma.gameRound.count({ where: { status: GameRoundStatus.IN_PROGRESS } }),
    ]);
    return {
      sessions: { total: sessions, active: activeSessions },
      rounds: { settled: settled._count._all, inProgress },
      wagered: (settled._sum.stake ?? new Prisma.Decimal(0)).toNumber(),
      winnings: (settled._sum.payout ?? new Prisma.Decimal(0)).toNumber(),
    };
  }

  /** How much a player has played: sessions, rounds, and when they first and last played. */
  async getUserActivityInfo(
    userId: string,
  ): Promise<{ sessions: number; rounds: number; firstRoundAt: Date | null; lastRoundAt: Date | null }> {
    const [sessions, rounds] = await Promise.all([
      this.prisma.gameSession.count({ where: { userId } }),
      this.prisma.gameRound.aggregate({
        where: { userId },
        _count: { _all: true },
        _min: { startedAt: true },
        _max: { startedAt: true },
      }),
    ]);
    return {
      sessions,
      rounds: rounds._count._all,
      firstRoundAt: rounds._min.startedAt,
      lastRoundAt: rounds._max.startedAt,
    };
  }

  // --- reports (admin) -----------------------------------------------------------

  /** Per-game round, player and credit totals (one SQL query: counting distinct players needs it). */
  async reportByGame(range: { from?: Date; to?: Date }): Promise<RawGameReportRow[]> {
    const rows = await this.prisma.$queryRaw<
      {
        gameRowId: string;
        rounds: number;
        settled: number;
        inProgress: number;
        players: number;
        wins: number;
        wagered: Prisma.Decimal;
        winnings: Prisma.Decimal;
      }[]
    >(Prisma.sql`
      SELECT r."gameId" AS "gameRowId",
             COUNT(*)::int AS "rounds",
             COUNT(*) FILTER (WHERE r."status" = 'SETTLED')::int AS "settled",
             COUNT(*) FILTER (WHERE r."status" = 'IN_PROGRESS')::int AS "inProgress",
             COUNT(DISTINCT r."userId")::int AS "players",
             COUNT(*) FILTER (WHERE r."status" = 'SETTLED' AND r."payout" > r."stake")::int AS "wins",
             COALESCE(SUM(r."stake"), 0) AS "wagered",
             COALESCE(SUM(r."payout"), 0) AS "winnings"
      FROM "game_rounds" r
      WHERE ${this.rangeSql('r."startedAt"', range)}
      GROUP BY r."gameId"
    `);
    return rows.map((row) => ({ ...row, wagered: Number(row.wagered), winnings: Number(row.winnings) }));
  }

  /** How many rounds per game had their entry refunded (ledger GAME_REFUND entries), within a date range. */
  async countRefundedRoundsByGame(range: { from?: Date; to?: Date }): Promise<Map<string, number>> {
    const rows = await this.prisma.walletTransaction.groupBy({
      by: ['gameId'],
      where: {
        type: 'GAME_REFUND',
        ...(range.from || range.to
          ? { createdAt: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } }
          : {}),
      },
      _count: { _all: true },
      orderBy: { gameId: 'asc' },
    });
    return new Map(rows.filter((row) => row.gameId).map((row) => [row.gameId as string, row._count._all]));
  }

  /** Rounds, active players and credits per calendar day (UTC). */
  async dailyActivity(range: { from?: Date; to?: Date }, gameRowId?: string): Promise<RawDailyRow[]> {
    const extra = gameRowId ? Prisma.sql`AND r."gameId" = ${gameRowId}` : Prisma.empty;
    const rows = await this.prisma.$queryRaw<
      { date: string; rounds: number; players: number; wagered: Prisma.Decimal; winnings: Prisma.Decimal }[]
    >(Prisma.sql`
      SELECT to_char(date_trunc('day', r."startedAt"), 'YYYY-MM-DD') AS "date",
             COUNT(*)::int AS "rounds",
             COUNT(DISTINCT r."userId")::int AS "players",
             COALESCE(SUM(r."stake"), 0) AS "wagered",
             COALESCE(SUM(r."payout"), 0) AS "winnings"
      FROM "game_rounds" r
      WHERE ${this.rangeSql('r."startedAt"', range)} ${extra}
      GROUP BY 1
      ORDER BY 1
    `);
    return rows.map((row) => ({ ...row, wagered: Number(row.wagered), winnings: Number(row.winnings) }));
  }

  /** Most active players in a date range. */
  async userActivity(params: {
    range: { from?: Date; to?: Date };
    sortBy: UserActivitySortField;
    limit: number;
  }): Promise<RawUserActivityRow[]> {
    const where = this.buildWhere({ from: params.range.from, to: params.range.to });
    const rows = await this.prisma.gameRound.groupBy({
      by: ['userId'],
      where,
      _count: { _all: true },
      _sum: { stake: true, payout: true },
      _max: { startedAt: true },
      orderBy: this.buildActivityOrder(params.sortBy),
      take: params.limit,
    });
    return rows.map((row) => ({
      userId: row.userId,
      rounds: row._count._all,
      wagered: (row._sum.stake ?? new Prisma.Decimal(0)).toNumber(),
      winnings: (row._sum.payout ?? new Prisma.Decimal(0)).toNumber(),
      lastActiveAt: row._max.startedAt,
    }));
  }

  // --- helpers ---------------------------------------------------------------------

  private async findGameNames(ids: string[]): Promise<Map<string, { gameId: string; name: string }>> {
    if (ids.length === 0) return new Map();
    const games = await this.prisma.game.findMany({
      where: { id: { in: ids } },
      select: { id: true, gameId: true, name: true },
    });
    return new Map(games.map((game) => [game.id, { gameId: game.gameId, name: game.name }]));
  }

  /** Public game ids and names for a set of game row ids (used by the reports). */
  findGameNamesById(ids: string[]): Promise<Map<string, { gameId: string; name: string }>> {
    return this.findGameNames(ids);
  }

  private rangeSql(column: string, range: { from?: Date; to?: Date }): Prisma.Sql {
    const parts: Prisma.Sql[] = [Prisma.sql`TRUE`];
    if (range.from) parts.push(Prisma.sql`${Prisma.raw(column)} >= ${range.from}`);
    if (range.to) parts.push(Prisma.sql`${Prisma.raw(column)} <= ${range.to}`);
    return Prisma.join(parts, ' AND ');
  }

  private buildWhere(filter: HistoryFilter): Prisma.GameRoundWhereInput {
    const conditions: Prisma.GameRoundWhereInput[] = [];
    if (filter.userId) conditions.push({ userId: filter.userId });
    if (filter.gameRowId) conditions.push({ gameId: filter.gameRowId });
    if (filter.status) conditions.push({ status: filter.status });
    if (filter.from) conditions.push({ startedAt: { gte: filter.from } });
    if (filter.to) conditions.push({ startedAt: { lte: filter.to } });

    if (filter.outcome) {
      // Outcomes only exist for settled rounds: compare what was paid with what was staked (column to column).
      const { stake } = this.prisma.gameRound.fields;
      conditions.push({ status: GameRoundStatus.SETTLED });
      conditions.push(
        filter.outcome === RoundOutcome.Win
          ? { payout: { gt: stake } }
          : filter.outcome === RoundOutcome.Loss
            ? { payout: { lt: stake } }
            : { payout: { equals: stake } },
      );
    }
    return conditions.length > 0 ? { AND: conditions } : {};
  }

  private buildOrderBy({ field, order }: SortParams<GameHistorySortField>): Prisma.GameRoundOrderByWithRelationInput[] {
    const direction = toSortDirection(order);
    switch (field) {
      case GameHistorySortField.SettledAt:
        return [{ settledAt: { sort: direction, nulls: 'last' } }, { id: 'asc' }];
      case GameHistorySortField.Stake:
        return [{ stake: direction }, { startedAt: 'desc' }, { id: 'asc' }];
      case GameHistorySortField.Payout:
        return [{ payout: direction }, { startedAt: 'desc' }, { id: 'asc' }];
      case GameHistorySortField.StartedAt:
      default:
        return [{ startedAt: direction }, { id: 'asc' }];
    }
  }

  private buildActivityOrder(sortBy: UserActivitySortField): ActivityOrder {
    switch (sortBy) {
      case UserActivitySortField.Wagered:
        return { _sum: { stake: 'desc' } };
      case UserActivitySortField.Winnings:
        return { _sum: { payout: 'desc' } };
      case UserActivitySortField.LastActive:
        return { _max: { startedAt: 'desc' } };
      case UserActivitySortField.Rounds:
      default:
        return { _count: { id: 'desc' } };
    }
  }
}
