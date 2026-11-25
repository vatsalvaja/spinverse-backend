import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NO_FIELDS_TO_UPDATE } from '../../common/constants/validation.constants';
import { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { hasDefinedValues } from '../../common/utils/object.util';
import { buildPaginatedResult, toSkipTake } from '../../common/utils/pagination.util';
import { GameCategoriesService } from '../game-categories/game-categories.service';
import { GAME_ERRORS, GAME_SETTINGS_MAX_BYTES } from './constants/games.constants';
import { CreateGameDto } from './dto/create-game.dto';
import { ListGamesQueryDto } from './dto/list-games-query.dto';
import { UpdateGameConfigDto } from './dto/update-game-config.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { GameStatus } from './enums/game-status.enum';
import { GamesRepository } from './games.repository';
import { GameConfig, GameWithCategory } from './interfaces/game.interface';
import { toGameConfig } from './mappers/game.mapper';

/** Admin operations on the game catalog. */
@Injectable()
export class GamesService {
  constructor(
    private readonly gamesRepository: GamesRepository,
    private readonly categoriesService: GameCategoriesService,
  ) {}

  getCounts() {
    return this.gamesRepository.getCounts();
  }

  /** Creates a DRAFT game. Enabling it is a separate, explicit step. */
  async create(dto: CreateGameDto): Promise<GameWithCategory> {
    await this.categoriesService.getAssignable(dto.categoryId);

    if (await this.gamesRepository.existsByGameId(dto.gameId)) {
      throw new ConflictException(GAME_ERRORS.GAME_ID_TAKEN);
    }

    // A concurrent duplicate still hits the unique index; the global filter maps it to 409.
    return this.gamesRepository.create({
      gameId: dto.gameId,
      name: dto.name,
      description: dto.description,
      developer: dto.developer,
      categoryId: dto.categoryId,
      thumbnail: dto.thumbnail,
      version: dto.version,
    });
  }

  async list(query: ListGamesQueryDto): Promise<PaginatedResult<GameWithCategory>> {
    const { items, total } = await this.gamesRepository.findMany({
      filter: {
        search: query.search,
        status: query.status,
        categoryId: query.categoryId,
        visibilities: query.visibility ? [query.visibility] : undefined,
        featured: query.featured,
      },
      sort: { field: query.sortBy, order: query.sortOrder },
      ...toSkipTake(query.page, query.limit),
    });
    return buildPaginatedResult(items, total, query.page, query.limit);
  }

  getById(id: string): Promise<GameWithCategory> {
    return this.getByIdOrFail(id);
  }

  async update(id: string, dto: UpdateGameDto): Promise<GameWithCategory> {
    if (!hasDefinedValues(dto)) throw new BadRequestException(NO_FIELDS_TO_UPDATE);

    const game = await this.getByIdOrFail(id);
    if (dto.categoryId !== undefined && dto.categoryId !== game.categoryId) {
      await this.categoriesService.getAssignable(dto.categoryId);
    }

    return this.gamesRepository.update(id, {
      name: dto.name,
      description: dto.description,
      developer: dto.developer,
      categoryId: dto.categoryId,
      thumbnail: dto.thumbnail,
      version: dto.version,
    });
  }

  /** DRAFT / DISABLED -> ACTIVE. The game's category must be active. */
  async enable(id: string): Promise<GameWithCategory> {
    const game = await this.getByIdOrFail(id);
    if (game.status === GameStatus.ACTIVE) return game;

    if (!game.category.isActive) throw new BadRequestException(GAME_ERRORS.CATEGORY_INACTIVE);
    return this.gamesRepository.updateStatus(id, GameStatus.ACTIVE);
  }

  /** Any status -> DISABLED. The game disappears from the player catalog. */
  async disable(id: string): Promise<GameWithCategory> {
    const game = await this.getByIdOrFail(id);
    if (game.status === GameStatus.DISABLED) return game;

    return this.gamesRepository.updateStatus(id, GameStatus.DISABLED);
  }

  async getConfig(id: string): Promise<GameConfig> {
    return toGameConfig(await this.getByIdOrFail(id));
  }

  async updateConfig(id: string, dto: UpdateGameConfigDto): Promise<GameConfig> {
    if (!hasDefinedValues(dto)) throw new BadRequestException(NO_FIELDS_TO_UPDATE);

    if (
      dto.settings !== undefined &&
      Buffer.byteLength(JSON.stringify(dto.settings), 'utf8') > GAME_SETTINGS_MAX_BYTES
    ) {
      throw new BadRequestException(GAME_ERRORS.SETTINGS_TOO_LARGE);
    }

    await this.getByIdOrFail(id);
    return toGameConfig(
      await this.gamesRepository.updateConfig(id, {
        visibility: dto.visibility,
        featured: dto.featured,
        displayOrder: dto.displayOrder,
        orientation: dto.orientation,
        platforms: dto.platforms,
        minClientVersion: dto.minClientVersion,
        settings: dto.settings,
      }),
    );
  }

  private async getByIdOrFail(id: string): Promise<GameWithCategory> {
    const game = await this.gamesRepository.findById(id);
    if (!game) throw new NotFoundException(GAME_ERRORS.NOT_FOUND);
    return game;
  }
}
