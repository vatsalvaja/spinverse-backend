import { Injectable } from '@nestjs/common';
import { GameCategory, Prisma } from '@prisma/client';
import { SortParams } from '../../common/interfaces/pagination.interface';
import { toSortDirection } from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma.service';
import { GameCategorySortField } from './enums/game-category-sort-field.enum';
import {
  CreateGameCategoryData,
  GameCategoryListFilter,
  UpdateGameCategoryData,
} from './interfaces/game-category.interface';

@Injectable()
export class GameCategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<GameCategory | null> {
    return this.prisma.gameCategory.findUnique({ where: { id } });
  }

  /** Case-insensitive; `excludeId` lets an update keep its own name. */
  async existsByName(name: string, excludeId?: string): Promise<boolean> {
    const count = await this.prisma.gameCategory.count({
      where: {
        name: { equals: name, mode: 'insensitive' },
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    return count > 0;
  }

  async existsBySlug(slug: string, excludeId?: string): Promise<boolean> {
    const count = await this.prisma.gameCategory.count({
      where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    });
    return count > 0;
  }

  create(data: CreateGameCategoryData): Promise<GameCategory> {
    return this.prisma.gameCategory.create({ data });
  }

  update(id: string, data: UpdateGameCategoryData): Promise<GameCategory> {
    return this.prisma.gameCategory.update({ where: { id }, data });
  }

  async findMany(params: {
    filter: GameCategoryListFilter;
    sort: SortParams<GameCategorySortField>;
    skip: number;
    take: number;
  }): Promise<{ items: GameCategory[]; total: number }> {
    const where = this.buildWhere(params.filter);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.gameCategory.findMany({
        where,
        orderBy: this.buildOrderBy(params.sort),
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.gameCategory.count({ where }),
    ]);

    return { items, total };
  }

  private buildWhere(filter: GameCategoryListFilter): Prisma.GameCategoryWhereInput {
    const conditions: Prisma.GameCategoryWhereInput[] = [];

    if (filter.search) {
      conditions.push({
        OR: [
          { name: { contains: filter.search, mode: 'insensitive' } },
          { slug: { contains: filter.search, mode: 'insensitive' } },
        ],
      });
    }
    if (filter.isActive !== undefined) conditions.push({ isActive: filter.isActive });

    return conditions.length > 0 ? { AND: conditions } : {};
  }

  private buildOrderBy({
    field,
    order,
  }: SortParams<GameCategorySortField>): Prisma.GameCategoryOrderByWithRelationInput[] {
    const direction = toSortDirection(order);

    switch (field) {
      case GameCategorySortField.Name:
        return [{ name: direction }, { id: 'asc' }];
      case GameCategorySortField.CreatedAt:
        return [{ createdAt: direction }, { id: 'asc' }];
      case GameCategorySortField.DisplayOrder:
      default:
        return [{ sortOrder: direction }, { name: 'asc' }, { id: 'asc' }];
    }
  }
}
