import { Controller, Get, HttpStatus, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { ApiSuccessResponse } from '../../common/decorators/api-success-response.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Role } from '../../common/enums/role.enum';
import type { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { Auth } from '../auth/decorators/auth.decorator';
import { ADMIN_GAME_HISTORY_API_TAG, ADMIN_GAME_HISTORY_ROUTE, HISTORY_MESSAGES } from './constants/game-history.constants';
import {
  AdminGameHistoryStatsQueryDto,
  AdminListGameHistoryQueryDto,
  ListGameHistoryQueryDto,
} from './dto/game-history-queries.dto';
import { HistoryStatsDto, RoundHistoryDetailDto, RoundHistoryItemDto } from './dto/game-history-response.dto';
import { GameHistoryService } from './game-history.service';
import type { HistoryStats, RoundHistoryDetail, RoundHistoryItem } from './interfaces/game-history.interface';

/** Game history of all players. Every route requires the ADMIN role. */
@ApiTags(ADMIN_GAME_HISTORY_API_TAG)
@Controller(ADMIN_GAME_HISTORY_ROUTE)
@Auth(Role.ADMIN)
export class AdminGameHistoryController {
  constructor(private readonly historyService: GameHistoryService) {}

  @Get()
  @ResponseMessage(HISTORY_MESSAGES.LISTED)
  @ApiOperation({
    summary: 'Game history of all players',
    description: 'Filter by user, game, status, outcome and date range; sort by start time, settle time, stake or payout.',
  })
  @ApiPaginatedResponse(RoundHistoryItemDto, 'Paginated rounds (with player names)')
  @ApiErrors(HttpStatus.BAD_REQUEST)
  list(@Query() query: AdminListGameHistoryQueryDto): Promise<PaginatedResult<RoundHistoryItem>> {
    return this.historyService.listAll(query);
  }

  // Fixed paths are declared before `:roundId`.
  @Get('stats')
  @ResponseMessage(HISTORY_MESSAGES.STATS)
  @ApiOperation({
    summary: 'Platform-wide game statistics',
    description: 'Optionally limited to one user, one game or a date range. Includes a per-game breakdown.',
  })
  @ApiSuccessResponse(HistoryStatsDto, 'The statistics')
  @ApiErrors(HttpStatus.BAD_REQUEST)
  stats(@Query() query: AdminGameHistoryStatsQueryDto): Promise<HistoryStats> {
    return this.historyService.getAdminStats(query);
  }

  @Get('users/:userId')
  @ResponseMessage(HISTORY_MESSAGES.LISTED)
  @ApiOperation({ summary: "One player's game history" })
  @ApiPaginatedResponse(RoundHistoryItemDto, "Paginated rounds of that player")
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  listForUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: ListGameHistoryQueryDto,
  ): Promise<PaginatedResult<RoundHistoryItem>> {
    return this.historyService.listForUser(userId, query);
  }

  @Get('games/:gameId')
  @ResponseMessage(HISTORY_MESSAGES.LISTED)
  @ApiOperation({ summary: 'History of one game (`:gameId` is the public game id, e.g. skyfall)' })
  @ApiPaginatedResponse(RoundHistoryItemDto, 'Paginated rounds of that game')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  listForGame(
    @Param('gameId') gameId: string,
    @Query() query: AdminListGameHistoryQueryDto,
  ): Promise<PaginatedResult<RoundHistoryItem>> {
    return this.historyService.listForGame(gameId, query);
  }

  @Get(':roundId')
  @ResponseMessage(HISTORY_MESSAGES.DETAIL)
  @ApiOperation({
    summary: 'Inspect one round',
    description:
      'The stored result and bet, game and package versions, and every wallet ledger entry (with idempotency keys). ' +
      'The seed and private round state are available through GET /admin/game-rounds/:id.',
  })
  @ApiSuccessResponse(RoundHistoryDetailDto, 'The round')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  getRound(@Param('roundId', ParseUUIDPipe) roundId: string): Promise<RoundHistoryDetail> {
    return this.historyService.getAdminDetail(roundId);
  }
}
