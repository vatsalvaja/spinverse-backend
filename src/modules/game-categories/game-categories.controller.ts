import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { GameCategory } from '@prisma/client';
import { ApiErrors } from '../../common/decorators/api-errors.decorator';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import type { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { Auth } from '../auth/decorators/auth.decorator';
import {
  CATEGORY_MESSAGES,
  GAME_CATEGORIES_API_TAG,
  GAME_CATEGORIES_ROUTE,
} from './constants/game-categories.constants';
import { GameCategoryResponseDto } from './dto/game-category-response.dto';
import { ListGameCategoriesQueryDto } from './dto/list-game-categories-query.dto';
import { GameCategoriesService } from './game-categories.service';

/** Player-facing category list for any signed-in user. */
@ApiTags(GAME_CATEGORIES_API_TAG)
@Controller(GAME_CATEGORIES_ROUTE)
@Auth()
export class GameCategoriesController {
  constructor(private readonly categoriesService: GameCategoriesService) {}

  @Get()
  @ResponseMessage(CATEGORY_MESSAGES.LISTED)
  @ApiOperation({ summary: 'List active game categories' })
  @ApiPaginatedResponse(GameCategoryResponseDto, 'Paginated active categories')
  @ApiErrors(HttpStatus.BAD_REQUEST)
  list(@Query() query: ListGameCategoriesQueryDto): Promise<PaginatedResult<GameCategory>> {
    return this.categoriesService.list(query, true);
  }
}
