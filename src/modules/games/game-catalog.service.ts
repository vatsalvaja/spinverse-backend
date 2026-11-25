import { Injectable, NotFoundException } from '@nestjs/common';
import { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { buildPaginatedResult, toSkipTake } from '../../common/utils/pagination.util';
import { GAME_ERRORS } from './constants/games.constants';
import { ListCatalogQueryDto } from './dto/list-catalog-query.dto';
import { GameStatus } from './enums/game-status.enum';
import { GameVisibility } from './enums/game-visibility.enum';
import { GamesRepository } from './games.repository';
import { GameCatalogItem } from './interfaces/game.interface';
import { toCatalogItem } from './mappers/game.mapper';

/** Read-only, player-facing view of the catalog. */
@Injectable()
export class GameCatalogService {
  constructor(private readonly gamesRepository: GamesRepository) {}

  /** Lists ACTIVE, PUBLIC games whose category is active. */
  async list(query: ListCatalogQueryDto): Promise<PaginatedResult<GameCatalogItem>> {
    const { items, total } = await this.gamesRepository.findMany({
      filter: {
        search: query.search,
        categorySlug: query.category,
        featured: query.featured,
        status: GameStatus.ACTIVE,
        visibilities: [GameVisibility.PUBLIC],
        activeCategoryOnly: true,
      },
      sort: { field: query.sortBy, order: query.sortOrder },
      ...toSkipTake(query.page, query.limit),
    });
    return buildPaginatedResult(items.map(toCatalogItem), total, query.page, query.limit);
  }

  /** ACTIVE games that are PUBLIC or HIDDEN (hidden = not listed, but reachable by game id). */
  async getByGameId(gameId: string): Promise<GameCatalogItem> {
    const game = await this.gamesRepository.findByGameId(gameId);

    const reachable =
      game !== null &&
      game.status === GameStatus.ACTIVE &&
      game.visibility !== GameVisibility.PRIVATE &&
      game.category.isActive;
    if (!game || !reachable) throw new NotFoundException(GAME_ERRORS.NOT_FOUND);

    return toCatalogItem(game);
  }
}
