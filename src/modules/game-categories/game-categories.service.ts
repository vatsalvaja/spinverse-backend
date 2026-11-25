import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GameCategory } from '@prisma/client';
import { NO_FIELDS_TO_UPDATE } from '../../common/constants/validation.constants';
import { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { hasDefinedValues } from '../../common/utils/object.util';
import { buildPaginatedResult, toSkipTake } from '../../common/utils/pagination.util';
import { slugify } from '../../common/utils/slug.util';
import { CATEGORY_ERRORS } from './constants/game-categories.constants';
import { CreateGameCategoryDto } from './dto/create-game-category.dto';
import { ListGameCategoriesQueryDto } from './dto/list-game-categories-query.dto';
import { UpdateGameCategoryDto } from './dto/update-game-category.dto';
import { GameCategoriesRepository } from './game-categories.repository';

@Injectable()
export class GameCategoriesService {
  constructor(private readonly categoriesRepository: GameCategoriesRepository) {}

  async create(dto: CreateGameCategoryDto): Promise<GameCategory> {
    const slug = dto.slug ?? slugify(dto.name);
    if (!slug) throw new BadRequestException(CATEGORY_ERRORS.CANNOT_DERIVE_SLUG);

    await this.assertUnique(dto.name, slug);

    return this.categoriesRepository.create({
      name: dto.name,
      slug,
      description: dto.description,
      sortOrder: dto.sortOrder,
    });
  }

  /** `activeOnly` powers the player-facing list, which never shows inactive categories. */
  async list(
    query: ListGameCategoriesQueryDto,
    activeOnly = false,
  ): Promise<PaginatedResult<GameCategory>> {
    const { items, total } = await this.categoriesRepository.findMany({
      filter: { search: query.search, isActive: activeOnly ? true : query.isActive },
      sort: { field: query.sortBy, order: query.sortOrder },
      ...toSkipTake(query.page, query.limit),
    });
    return buildPaginatedResult(items, total, query.page, query.limit);
  }

  getById(id: string): Promise<GameCategory> {
    return this.getByIdOrFail(id);
  }

  async update(id: string, dto: UpdateGameCategoryDto): Promise<GameCategory> {
    if (!hasDefinedValues(dto)) throw new BadRequestException(NO_FIELDS_TO_UPDATE);

    const category = await this.getByIdOrFail(id);

    const name = dto.name !== undefined && dto.name !== category.name ? dto.name : undefined;
    const slug = dto.slug !== undefined && dto.slug !== category.slug ? dto.slug : undefined;
    await this.assertUnique(name, slug, id);

    return this.categoriesRepository.update(id, {
      name: dto.name,
      slug: dto.slug,
      description: dto.description,
      sortOrder: dto.sortOrder,
    });
  }

  async setActive(id: string, isActive: boolean): Promise<GameCategory> {
    const category = await this.getByIdOrFail(id);
    if (category.isActive === isActive) return category;
    return this.categoriesRepository.update(id, { isActive });
  }

  /** The category a game may be assigned to: it must exist and be active. */
  async getAssignable(id: string): Promise<GameCategory> {
    const category = await this.getByIdOrFail(id);
    if (!category.isActive) throw new BadRequestException(CATEGORY_ERRORS.INACTIVE);
    return category;
  }

  private async getByIdOrFail(id: string): Promise<GameCategory> {
    const category = await this.categoriesRepository.findById(id);
    if (!category) throw new NotFoundException(CATEGORY_ERRORS.NOT_FOUND);
    return category;
  }

  /** Checks only the values provided; a concurrent duplicate is still caught by the unique index. */
  private async assertUnique(name?: string, slug?: string, excludeId?: string): Promise<void> {
    if (name !== undefined && (await this.categoriesRepository.existsByName(name, excludeId))) {
      throw new ConflictException(CATEGORY_ERRORS.NAME_TAKEN);
    }
    if (slug !== undefined && (await this.categoriesRepository.existsBySlug(slug, excludeId))) {
      throw new ConflictException(CATEGORY_ERRORS.SLUG_TAKEN);
    }
  }
}
