import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SortParams } from '../../common/interfaces/pagination.interface';
import { toSortDirection } from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma.service';
import { GameSortField } from './enums/game-sort-field.enum';
import { GameStatus } from './enums/game-status.enum';
import {
  CreateGameData,
  GameListFilter,
  GameWithCategory,
  UpdateGameConfigData,
  UpdateGameData,
} from './interfaces/game.interface';

const WITH_CATEGORY = { category: true } satisfies Prisma.GameInclude;

@Injectable()
export class GamesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<GameWithCategory | null> {
    return this.prisma.game.findUnique({ where: { id }, include: WITH_CATEGORY });
  }

  findByGameId(gameId: string): Promise<GameWithCategory | null> {
    return this.prisma.game.findUnique({ where: { gameId }, include: WITH_CATEGORY });
  }

  /** Catalog counts for the dashboard: by status and by package state. */
  async getCounts(): Promise<{ total: number; byStatus: Record<string, number>; installed: number; published: number }> {
    const [total, byStatus, installed, published] = await Promise.all([
      this.prisma.game.count(),
      this.prisma.game.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } }),
      this.prisma.game.count({ where: { installedVersion: { not: null } } }),
      this.prisma.game.count({ where: { publishedVersion: { not: null } } }),
    ]);
    return {
      total,
      byStatus: Object.fromEntries(byStatus.map((row) => [row.status, row._count._all])),
      installed,
      published,
    };
  }

  async existsByGameId(gameId: string): Promise<boolean> {
    const count = await this.prisma.game.count({ where: { gameId } });
    return count > 0;
  }

  create(data: CreateGameData): Promise<GameWithCategory> {
    return this.prisma.game.create({ data, include: WITH_CATEGORY });
  }

  update(id: string, data: UpdateGameData): Promise<GameWithCategory> {
    return this.prisma.game.update({ where: { id }, data, include: WITH_CATEGORY });
  }

  updateStatus(id: string, status: GameStatus): Promise<GameWithCategory> {
    return this.prisma.game.update({ where: { id }, data: { status }, include: WITH_CATEGORY });
  }

  updateConfig(id: string, { settings, ...rest }: UpdateGameConfigData): Promise<GameWithCategory> {
    return this.prisma.game.update({
      where: { id },
      data: { ...rest, settings: settings as Prisma.InputJsonObject | undefined },
      include: WITH_CATEGORY,
    });
  }

  async findMany(params: {
    filter: GameListFilter;
    sort: SortParams<GameSortField>;
    skip: number;
    take: number;
  }): Promise<{ items: GameWithCategory[]; total: number }> {
    const where = this.buildWhere(params.filter);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.game.findMany({
        where,
        include: WITH_CATEGORY,
        orderBy: this.buildOrderBy(params.sort),
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.game.count({ where }),
    ]);

    return { items, total };
  }

  private buildWhere(filter: GameListFilter): Prisma.GameWhereInput {
    const conditions: Prisma.GameWhereInput[] = [];

    if (filter.search) {
      conditions.push({
        OR: [
          { name: { contains: filter.search, mode: 'insensitive' } },
          { gameId: { contains: filter.search, mode: 'insensitive' } },
        ],
      });
    }
    if (filter.status) conditions.push({ status: filter.status });
    if (filter.categoryId) conditions.push({ categoryId: filter.categoryId });
    if (filter.categorySlug) conditions.push({ category: { slug: filter.categorySlug } });
    if (filter.visibilities?.length) conditions.push({ visibility: { in: filter.visibilities } });
    if (filter.featured !== undefined) conditions.push({ featured: filter.featured });
    if (filter.activeCategoryOnly) conditions.push({ category: { isActive: true } });

    return conditions.length > 0 ? { AND: conditions } : {};
  }

  /** `name` then `id` break ties so pages are stable. */
  private buildOrderBy({ field, order }: SortParams<GameSortField>): Prisma.GameOrderByWithRelationInput[] {
    const direction = toSortDirection(order);

    switch (field) {
      case GameSortField.Name:
        return [{ name: direction }, { id: 'asc' }];
      case GameSortField.CreatedAt:
        return [{ createdAt: direction }, { id: 'asc' }];
      case GameSortField.UpdatedAt:
        return [{ updatedAt: direction }, { id: 'asc' }];
      case GameSortField.DisplayOrder:
      default:
        return [{ displayOrder: direction }, { name: 'asc' }, { id: 'asc' }];
    }
  }
}
