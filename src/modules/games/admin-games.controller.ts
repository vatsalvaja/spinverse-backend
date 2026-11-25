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
import { ADMIN_GAMES_API_TAG, ADMIN_GAMES_ROUTE, GAME_MESSAGES } from './constants/games.constants';
import { CreateGameDto } from './dto/create-game.dto';
import { GameConfigResponseDto } from './dto/game-config-response.dto';
import { GameResponseDto } from './dto/game-response.dto';
import { ListGamesQueryDto } from './dto/list-games-query.dto';
import { UpdateGameConfigDto } from './dto/update-game-config.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { GamesService } from './games.service';
import type { GameConfig, GameWithCategory } from './interfaces/game.interface';
import { AUDIT_ACTIONS, AUDIT_RESOURCES } from '../audit/constants/audit.constants';
import { Audit } from '../audit/decorators/audit.decorator';

/** Game catalog administration. Every route requires the ADMIN role. */
@ApiTags(ADMIN_GAMES_API_TAG)
@Controller(ADMIN_GAMES_ROUTE)
@Auth(Role.ADMIN)
export class AdminGamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Post()
  @ResponseMessage(GAME_MESSAGES.CREATED)
  @Audit({ action: AUDIT_ACTIONS.GAME_CREATED, resourceType: AUDIT_RESOURCES.GAME, targetFromResult: true })
  @ApiOperation({
    summary: 'Create a game',
    description: 'The game starts in DRAFT status. Enable it when it is ready for players.',
  })
  @ApiSuccessResponse(GameResponseDto, 'Game created', HttpStatus.CREATED)
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  create(@Body() dto: CreateGameDto): Promise<GameWithCategory> {
    return this.gamesService.create(dto);
  }

  @Get()
  @ResponseMessage(GAME_MESSAGES.LISTED)
  @ApiOperation({ summary: 'List games (all statuses) with search, filters, sorting and pagination' })
  @ApiPaginatedResponse(GameResponseDto, 'Paginated games')
  @ApiErrors(HttpStatus.BAD_REQUEST)
  list(@Query() query: ListGamesQueryDto): Promise<PaginatedResult<GameWithCategory>> {
    return this.gamesService.list(query);
  }

  @Get(':id')
  @ResponseMessage(GAME_MESSAGES.FETCHED)
  @ApiOperation({ summary: 'Get a game by id' })
  @ApiSuccessResponse(GameResponseDto, 'The game')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  getById(@Param('id', ParseUUIDPipe) id: string): Promise<GameWithCategory> {
    return this.gamesService.getById(id);
  }

  @Patch(':id')
  @ResponseMessage(GAME_MESSAGES.UPDATED)
  @Audit({ action: AUDIT_ACTIONS.GAME_UPDATED, resourceType: AUDIT_RESOURCES.GAME, targetParam: 'id' })
  @ApiOperation({
    summary: 'Update game metadata',
    description:
      'Name, description, developer, category, thumbnail reference and version. The game ID is immutable; use enable / disable for status.',
  })
  @ApiSuccessResponse(GameResponseDto, 'The updated game')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGameDto,
  ): Promise<GameWithCategory> {
    return this.gamesService.update(id, dto);
  }

  @Patch(':id/enable')
  @ResponseMessage(GAME_MESSAGES.ENABLED)
  @Audit({ action: AUDIT_ACTIONS.GAME_ENABLED, resourceType: AUDIT_RESOURCES.GAME, targetParam: 'id' })
  @ApiOperation({ summary: 'Enable a game (status ACTIVE)' })
  @ApiSuccessResponse(GameResponseDto, 'The enabled game')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  enable(@Param('id', ParseUUIDPipe) id: string): Promise<GameWithCategory> {
    return this.gamesService.enable(id);
  }

  @Patch(':id/disable')
  @ResponseMessage(GAME_MESSAGES.DISABLED)
  @Audit({ action: AUDIT_ACTIONS.GAME_DISABLED, resourceType: AUDIT_RESOURCES.GAME, targetParam: 'id' })
  @ApiOperation({ summary: 'Disable a game (status DISABLED)' })
  @ApiSuccessResponse(GameResponseDto, 'The disabled game')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  disable(@Param('id', ParseUUIDPipe) id: string): Promise<GameWithCategory> {
    return this.gamesService.disable(id);
  }

  @Get(':id/config')
  @ResponseMessage(GAME_MESSAGES.CONFIG_FETCHED)
  @ApiOperation({ summary: 'Get a game configuration' })
  @ApiSuccessResponse(GameConfigResponseDto, 'The game configuration')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  getConfig(@Param('id', ParseUUIDPipe) id: string): Promise<GameConfig> {
    return this.gamesService.getConfig(id);
  }

  @Patch(':id/config')
  @ResponseMessage(GAME_MESSAGES.CONFIG_UPDATED)
  @Audit({ action: AUDIT_ACTIONS.GAME_CONFIG_UPDATED, resourceType: AUDIT_RESOURCES.GAME, targetParam: 'id' })
  @ApiOperation({
    summary: 'Update a game configuration',
    description:
      'Visibility, featured flag, display order, orientation, platforms, minimum client version and free-form settings. Only the fields sent are changed.',
  })
  @ApiSuccessResponse(GameConfigResponseDto, 'The updated configuration')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  updateConfig(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGameConfigDto,
  ): Promise<GameConfig> {
    return this.gamesService.updateConfig(id, dto);
  }
}
