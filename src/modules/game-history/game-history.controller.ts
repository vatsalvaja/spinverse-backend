import { Controller, Get, HttpStatus, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { ApiSuccessResponse } from '../../common/decorators/api-success-response.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import type { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { SafeUser } from '../users/interfaces/user.interface';
import { GAME_HISTORY_API_TAG, GAME_HISTORY_ROUTE, HISTORY_MESSAGES } from './constants/game-history.constants';
import { GameHistoryStatsQueryDto, ListGameHistoryQueryDto } from './dto/game-history-queries.dto';
import { HistoryStatsDto, RoundHistoryDetailDto, RoundHistoryItemDto } from './dto/game-history-response.dto';
import { GameHistoryService } from './game-history.service';
import type { HistoryStats, RoundHistoryDetail, RoundHistoryItem } from './interfaces/game-history.interface';

/**
 * A player's own game history across all games. Read-only: results and credit amounts are the server's records
 * and can never be submitted or changed by the client.
 */
@ApiTags(GAME_HISTORY_API_TAG)
@Controller(GAME_HISTORY_ROUTE)
@Auth()
export class GameHistoryController {
  constructor(private readonly historyService: GameHistoryService) {}

  @Get()
  @ResponseMessage(HISTORY_MESSAGES.LISTED)
  @ApiOperation({
    summary: 'My game history (all games)',
    description:
      'Newest first by default. Filter by game, status (IN_PROGRESS / SETTLED), outcome (WIN / LOSS / EVEN) and date range; ' +
      'sort by start time, settle time, stake or payout. A multi-step round (SKYFALL) is always ONE entry.',
  })
  @ApiPaginatedResponse(RoundHistoryItemDto, 'Paginated rounds')
  @ApiErrors(HttpStatus.BAD_REQUEST)
  list(
    @CurrentUser() user: SafeUser,
    @Query() query: ListGameHistoryQueryDto,
  ): Promise<PaginatedResult<RoundHistoryItem>> {
    return this.historyService.listForPlayer(user.id, query);
  }

  // `stats` and `games/:gameId` are declared before `:roundId` so they are never mistaken for a round id.
  @Get('stats')
  @ResponseMessage(HISTORY_MESSAGES.STATS)
  @ApiOperation({
    summary: 'My statistics',
    description:
      'Games played (settled rounds), wins, losses, credits wagered and won, net change, win rate, and a per-game breakdown. ' +
      'Optional `gameId`, `from` and `to` filters.',
  })
  @ApiSuccessResponse(HistoryStatsDto, 'My statistics')
  @ApiErrors(HttpStatus.BAD_REQUEST)
  stats(@CurrentUser() user: SafeUser, @Query() query: GameHistoryStatsQueryDto): Promise<HistoryStats> {
    return this.historyService.getPlayerStats(user.id, query);
  }

  @Get('games/:gameId')
  @ResponseMessage(HISTORY_MESSAGES.LISTED)
  @ApiOperation({
    summary: 'My history for one game (`:gameId` is the public game id, e.g. roulette)',
    description: 'Same filters and sorting as the main list.',
  })
  @ApiPaginatedResponse(RoundHistoryItemDto, 'Paginated rounds of that game')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  listForGame(
    @CurrentUser() user: SafeUser,
    @Param('gameId') gameId: string,
    @Query() query: ListGameHistoryQueryDto,
  ): Promise<PaginatedResult<RoundHistoryItem>> {
    return this.historyService.listForPlayerGame(user.id, gameId, query);
  }

  @Get(':roundId')
  @ResponseMessage(HISTORY_MESSAGES.DETAIL)
  @ApiOperation({
    summary: 'One of my rounds, with its result and wallet entries',
    description:
      'The authoritative result exactly as stored, the game and package versions, and every wallet ledger entry the round ' +
      'caused, with entry debits, winnings and refunds shown separately.',
  })
  @ApiSuccessResponse(RoundHistoryDetailDto, 'The round')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  getRound(
    @CurrentUser() user: SafeUser,
    @Param('roundId', ParseUUIDPipe) roundId: string,
  ): Promise<RoundHistoryDetail> {
    return this.historyService.getPlayerDetail(user.id, roundId);
  }
}
