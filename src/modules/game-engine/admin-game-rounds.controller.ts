import { Controller, Get, HttpStatus, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { ApiSuccessResponse } from '../../common/decorators/api-success-response.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Role } from '../../common/enums/role.enum';
import type { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { Auth } from '../auth/decorators/auth.decorator';
import { ADMIN_ROUNDS_API_TAG, ADMIN_ROUNDS_ROUTE, ENGINE_MESSAGES } from './constants/game-engine.constants';
import { AdminRoundResponseDto, RoundResponseDto } from './dto/game-play-response.dto';
import { ListAdminRoundsQueryDto } from './dto/list-admin-rounds-query.dto';
import { GameRoundsService } from './game-rounds.service';
import type { RoundAudit, RoundView } from './interfaces/game-session.interface';

/** Round history and audit data across all players. Every route requires the ADMIN role. */
@ApiTags(ADMIN_ROUNDS_API_TAG)
@Controller(ADMIN_ROUNDS_ROUTE)
@Auth(Role.ADMIN)
export class AdminGameRoundsController {
  constructor(private readonly roundsService: GameRoundsService) {}

  @Get()
  @ResponseMessage(ENGINE_MESSAGES.ROUNDS_LISTED)
  @ApiOperation({ summary: 'List rounds of all players (filter by game, player, status)' })
  @ApiPaginatedResponse(RoundResponseDto, 'Paginated rounds (newest first)')
  @ApiErrors(HttpStatus.BAD_REQUEST)
  list(@Query() query: ListAdminRoundsQueryDto): Promise<PaginatedResult<RoundView>> {
    return this.roundsService.listAll(query);
  }

  @Get(':id')
  @ResponseMessage(ENGINE_MESSAGES.ROUND_FETCHED)
  @ApiOperation({
    summary: 'One round with its full audit data',
    description: 'Seed, private round state and the full game state before the round are included for settled rounds.',
  })
  @ApiSuccessResponse(AdminRoundResponseDto, 'The round and its audit data')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  getOne(@Param('id', ParseUUIDPipe) id: string): Promise<{ round: RoundView; audit: RoundAudit | null }> {
    return this.roundsService.getForAdmin(id);
  }
}
