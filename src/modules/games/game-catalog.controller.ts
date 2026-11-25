import { Controller, Get, HttpStatus, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { ApiSuccessResponse } from '../../common/decorators/api-success-response.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import type { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { Auth } from '../auth/decorators/auth.decorator';
import { GAMES_API_TAG, GAMES_ROUTE, GAME_MESSAGES } from './constants/games.constants';
import { GameCatalogItemDto } from './dto/game-catalog-item.dto';
import { ListCatalogQueryDto } from './dto/list-catalog-query.dto';
import { GameCatalogService } from './game-catalog.service';
import type { GameCatalogItem } from './interfaces/game.interface';

/** Player-facing catalog for any signed-in user. */
@ApiTags(GAMES_API_TAG)
@Controller(GAMES_ROUTE)
@Auth()
export class GameCatalogController {
  constructor(private readonly catalogService: GameCatalogService) {}

  @Get()
  @ResponseMessage(GAME_MESSAGES.LISTED)
  @ApiOperation({
    summary: 'List games available to players',
    description: 'Only ACTIVE, PUBLIC games in active categories are listed.',
  })
  @ApiPaginatedResponse(GameCatalogItemDto, 'Paginated catalog')
  @ApiErrors(HttpStatus.BAD_REQUEST)
  list(@Query() query: ListCatalogQueryDto): Promise<PaginatedResult<GameCatalogItem>> {
    return this.catalogService.list(query);
  }

  @Get(':gameId')
  @ResponseMessage(GAME_MESSAGES.FETCHED)
  @ApiOperation({
    summary: 'Get a game by its game ID',
    description: 'Works for ACTIVE games that are PUBLIC or HIDDEN. Anything else returns 404.',
  })
  @ApiSuccessResponse(GameCatalogItemDto, 'The game')
  @ApiErrors(HttpStatus.NOT_FOUND)
  getByGameId(@Param('gameId') gameId: string): Promise<GameCatalogItem> {
    return this.catalogService.getByGameId(gameId.toLowerCase());
  }
}
