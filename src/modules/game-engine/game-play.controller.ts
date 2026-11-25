import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { ApiSuccessResponse } from '../../common/decorators/api-success-response.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import type { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { SafeUser } from '../users/interfaces/user.interface';
import { ENGINE_MESSAGES, SESSIONS_API_TAG } from './constants/game-engine.constants';
import {
  RoundAuditResponseDto,
  RoundResponseDto,
  SessionResponseDto,
} from './dto/game-play-response.dto';
import { PlayRoundDto, RoundActionDto } from './dto/play-round.dto';
import { GameRoundsService } from './game-rounds.service';
import { GameSessionsService } from './game-sessions.service';
import type { RoundAudit, RoundView, SessionView } from './interfaces/game-session.interface';

/**
 * Server-authoritative play for any signed-in user, with free demo credits only. The client sends a bet
 * (or an action) and shows what the server answers; it never decides a result.
 */
@ApiTags(SESSIONS_API_TAG)
@Controller()
@Auth()
export class GamePlayController {
  constructor(
    private readonly sessionsService: GameSessionsService,
    private readonly roundsService: GameRoundsService,
  ) {}

  @Post('games/:gameId/sessions')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(ENGINE_MESSAGES.SESSION_OPENED)
  @ApiOperation({
    summary: 'Start (or resume) a play session for a game',
    description:
      'Works only for games that are enabled, published and installed and that have a game engine. ' +
      'Returns your current active session for the game if you already have one.',
  })
  @ApiSuccessResponse(SessionResponseDto, 'The session')
  @ApiErrors(HttpStatus.NOT_FOUND)
  open(@CurrentUser() user: SafeUser, @Param('gameId') gameId: string): Promise<SessionView> {
    return this.sessionsService.open(user, gameId.toLowerCase());
  }

  @Get('game-sessions/:sessionId')
  @ResponseMessage(ENGINE_MESSAGES.SESSION_FETCHED)
  @ApiOperation({ summary: 'Get one of my play sessions' })
  @ApiSuccessResponse(SessionResponseDto, 'The session')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  getSession(
    @CurrentUser() user: SafeUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ): Promise<SessionView> {
    return this.sessionsService.get(user, sessionId);
  }

  @Post('game-sessions/:sessionId/close')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(ENGINE_MESSAGES.SESSION_CLOSED)
  @ApiOperation({
    summary: 'End a play session',
    description: 'Refused while a round is still running. Ending the session also makes the seeds of all its rounds visible.',
  })
  @ApiSuccessResponse(SessionResponseDto, 'The closed session')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  close(
    @CurrentUser() user: SafeUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ): Promise<SessionView> {
    return this.sessionsService.close(user, sessionId);
  }

  @Post('game-sessions/:sessionId/rounds')
  @ResponseMessage(ENGINE_MESSAGES.ROUND_PLAYED)
  @ApiOperation({
    summary: 'Play a round',
    description:
      'Sends your bet. The server checks it against the game rules, takes the stake from your demo credits, draws the ' +
      'result with its secure random generator and pays any win, all in one step. Instant games (slots, Roulette, ' +
      'Tiger Clash) return a settled round; SKYFALL returns an open round to cash out of.',
  })
  @ApiSuccessResponse(RoundResponseDto, 'The round', HttpStatus.CREATED)
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  play(
    @CurrentUser() user: SafeUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: PlayRoundDto,
  ): Promise<RoundView> {
    return this.roundsService.play(user, sessionId, dto.bet);
  }

  @Get('game-sessions/:sessionId/rounds')
  @ResponseMessage(ENGINE_MESSAGES.ROUNDS_LISTED)
  @ApiOperation({ summary: 'Round history of a session (newest first)' })
  @ApiPaginatedResponse(RoundResponseDto, 'Paginated rounds')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  list(
    @CurrentUser() user: SafeUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<RoundView>> {
    return this.roundsService.list(user, sessionId, query);
  }

  @Get('game-sessions/:sessionId/rounds/:roundId')
  @ResponseMessage(ENGINE_MESSAGES.ROUND_FETCHED)
  @ApiOperation({
    summary: 'Get one round',
    description: 'An open round (SKYFALL) is brought up to date from the server clock, so poll this to follow the flight.',
  })
  @ApiSuccessResponse(RoundResponseDto, 'The round')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  getRound(
    @CurrentUser() user: SafeUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('roundId', ParseUUIDPipe) roundId: string,
  ): Promise<RoundView> {
    return this.roundsService.get(user, sessionId, roundId);
  }

  @Post('game-sessions/:sessionId/rounds/:roundId/actions')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(ENGINE_MESSAGES.ACTION_APPLIED)
  @ApiOperation({
    summary: 'Act inside an open round',
    description: 'SKYFALL: `{ "action": { "type": "CASH_OUT", "panel": 0 } }` cashes a bet out at the multiplier the server computes from its own clock.',
  })
  @ApiSuccessResponse(RoundResponseDto, 'The round after the action')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  act(
    @CurrentUser() user: SafeUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('roundId', ParseUUIDPipe) roundId: string,
    @Body() dto: RoundActionDto,
  ): Promise<RoundView> {
    return this.roundsService.act(user, sessionId, roundId, dto.action);
  }

  @Get('game-sessions/:sessionId/rounds/:roundId/audit')
  @ResponseMessage(ENGINE_MESSAGES.AUDIT_FETCHED)
  @ApiOperation({
    summary: 'Fairness details of a settled round',
    description:
      'The secret seed, its commitment, the engine version and how to verify them. The seed is shown once the round is settled; ' +
      'for Tiger Clash (a shuffled deck is shared by later rounds) it is shown when the session has ended.',
  })
  @ApiSuccessResponse(RoundAuditResponseDto, 'The audit details')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  audit(
    @CurrentUser() user: SafeUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('roundId', ParseUUIDPipe) roundId: string,
  ): Promise<RoundAudit> {
    return this.roundsService.audit(user, sessionId, roundId);
  }
}
