import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator';
import { ApiSuccessResponse } from '../../common/decorators/api-success-response.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Role } from '../../common/enums/role.enum';
import { Auth } from '../auth/decorators/auth.decorator';
import { DateRangeQueryDto, UserActivityQueryDto } from '../game-history/dto/game-history-queries.dto';
import type { GameReportRow, UserActivityRow } from '../game-history/interfaces/game-history.interface';
import { AdminReportsService } from './admin-reports.service';
import {
  ADMIN_REPORTS_API_TAG,
  ADMIN_REPORTS_ROUTE,
  DASHBOARD_MESSAGES,
} from './constants/admin-dashboard.constants';
import { DailyReportRowDto, GameReportRowDto, UserActivityRowDto } from './dto/admin-dashboard-response.dto';
import { DailyReportQueryDto } from './dto/admin-report-queries.dto';
import type { DailyReportRow } from './interfaces/admin-dashboard.interface';

/** Reports over the authoritative round records and the wallet ledger. Every route requires the ADMIN role. */
@ApiTags(ADMIN_REPORTS_API_TAG)
@Controller(ADMIN_REPORTS_ROUTE)
@Auth(Role.ADMIN)
export class AdminReportsController {
  constructor(private readonly reportsService: AdminReportsService) {}

  @Get('games')
  @ResponseMessage(DASHBOARD_MESSAGES.GAME_REPORT)
  @ApiOperation({
    summary: 'Report by game',
    description:
      'For each game: rounds (completed / in progress / refunded), different players, credits wagered and won, net, and the ' +
      'observed return. Optional date range. (The array of rows is in `data`.) Recent results: GET /admin/game-history.',
  })
  @ApiSuccessResponse(GameReportRowDto, 'One row per game (the data is an array of this object)')
  @ApiErrors(HttpStatus.BAD_REQUEST)
  gameReport(@Query() query: DateRangeQueryDto): Promise<GameReportRow[]> {
    return this.reportsService.getGameReport({ from: query.from, to: query.to });
  }

  @Get('daily')
  @ResponseMessage(DASHBOARD_MESSAGES.DAILY_REPORT)
  @ApiOperation({
    summary: 'Day-by-day statistics',
    description:
      'Per UTC day: rounds, active players, credits wagered and won, new registrations and wallet credits / debits. ' +
      'Defaults to the last 30 days (at most 366). Optionally limited to one game (affects the round columns only).',
  })
  @ApiSuccessResponse(DailyReportRowDto, 'One row per day (the data is an array of this object)')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  dailyReport(@Query() query: DailyReportQueryDto): Promise<DailyReportRow[]> {
    return this.reportsService.getDailyReport(query);
  }

  @Get('user-activity')
  @ResponseMessage(DASHBOARD_MESSAGES.USER_ACTIVITY)
  @ApiOperation({
    summary: 'Most active players',
    description: 'Top players by rounds, credits wagered, credits won or last activity, within an optional date range.',
  })
  @ApiSuccessResponse(UserActivityRowDto, 'One row per player (the data is an array of this object)')
  @ApiErrors(HttpStatus.BAD_REQUEST)
  userActivity(@Query() query: UserActivityQueryDto): Promise<UserActivityRow[]> {
    return this.reportsService.getUserActivity(query);
  }
}
