import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { ApiSuccessResponse } from '../../common/decorators/api-success-response.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Role } from '../../common/enums/role.enum';
import type { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { Auth } from '../auth/decorators/auth.decorator';
import {
  ADMIN_GAME_CATEGORIES_API_TAG,
  ADMIN_GAME_CATEGORIES_ROUTE,
  CATEGORY_MESSAGES,
} from './constants/game-categories.constants';
import { CreateGameCategoryDto } from './dto/create-game-category.dto';
import { GameCategoryResponseDto } from './dto/game-category-response.dto';
import { ListGameCategoriesQueryDto } from './dto/list-game-categories-query.dto';
import { UpdateGameCategoryDto } from './dto/update-game-category.dto';
import { GameCategoriesService } from './game-categories.service';
import type { GameCategory } from '@prisma/client';
import { AUDIT_ACTIONS, AUDIT_RESOURCES } from '../audit/constants/audit.constants';
import { Audit } from '../audit/decorators/audit.decorator';

/** Game category administration. Every route requires the ADMIN role. */
@ApiTags(ADMIN_GAME_CATEGORIES_API_TAG)
@Controller(ADMIN_GAME_CATEGORIES_ROUTE)
@Auth(Role.ADMIN)
export class AdminGameCategoriesController {
  constructor(private readonly categoriesService: GameCategoriesService) {}

  @Post()
  @ResponseMessage(CATEGORY_MESSAGES.CREATED)
  @Audit({ action: AUDIT_ACTIONS.CATEGORY_CREATED, resourceType: AUDIT_RESOURCES.GAME_CATEGORY, targetFromResult: true })
  @ApiOperation({ summary: 'Create a game category' })
  @ApiSuccessResponse(GameCategoryResponseDto, 'Category created', HttpStatus.CREATED)
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.CONFLICT)
  create(@Body() dto: CreateGameCategoryDto): Promise<GameCategory> {
    return this.categoriesService.create(dto);
  }

  @Get()
  @ResponseMessage(CATEGORY_MESSAGES.LISTED)
  @ApiOperation({ summary: 'List game categories (all statuses)' })
  @ApiPaginatedResponse(GameCategoryResponseDto, 'Paginated categories')
  @ApiErrors(HttpStatus.BAD_REQUEST)
  list(@Query() query: ListGameCategoriesQueryDto): Promise<PaginatedResult<GameCategory>> {
    return this.categoriesService.list(query);
  }

  @Get(':id')
  @ResponseMessage(CATEGORY_MESSAGES.FETCHED)
  @ApiOperation({ summary: 'Get a game category by id' })
  @ApiSuccessResponse(GameCategoryResponseDto, 'The category')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  getById(@Param('id', ParseUUIDPipe) id: string): Promise<GameCategory> {
    return this.categoriesService.getById(id);
  }

  @Patch(':id')
  @ResponseMessage(CATEGORY_MESSAGES.UPDATED)
  @Audit({ action: AUDIT_ACTIONS.CATEGORY_UPDATED, resourceType: AUDIT_RESOURCES.GAME_CATEGORY, targetParam: 'id' })
  @ApiOperation({ summary: 'Update a game category' })
  @ApiSuccessResponse(GameCategoryResponseDto, 'The updated category')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGameCategoryDto,
  ): Promise<GameCategory> {
    return this.categoriesService.update(id, dto);
  }

  @Patch(':id/activate')
  @ResponseMessage(CATEGORY_MESSAGES.ACTIVATED)
  @Audit({ action: AUDIT_ACTIONS.CATEGORY_ACTIVATED, resourceType: AUDIT_RESOURCES.GAME_CATEGORY, targetParam: 'id' })
  @ApiOperation({ summary: 'Activate a game category' })
  @ApiSuccessResponse(GameCategoryResponseDto, 'The activated category')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  activate(@Param('id', ParseUUIDPipe) id: string): Promise<GameCategory> {
    return this.categoriesService.setActive(id, true);
  }

  @Patch(':id/deactivate')
  @ResponseMessage(CATEGORY_MESSAGES.DEACTIVATED)
  @Audit({ action: AUDIT_ACTIONS.CATEGORY_DEACTIVATED, resourceType: AUDIT_RESOURCES.GAME_CATEGORY, targetParam: 'id' })
  @ApiOperation({
    summary: 'Deactivate a game category',
    description:
      'Games in an inactive category disappear from the player catalog and no new game can be assigned to it.',
  })
  @ApiSuccessResponse(GameCategoryResponseDto, 'The deactivated category')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<GameCategory> {
    return this.categoriesService.setActive(id, false);
  }
}
