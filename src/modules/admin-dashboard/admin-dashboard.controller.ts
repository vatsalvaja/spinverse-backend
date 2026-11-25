import { Controller, Get, HttpStatus, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator';
import { ApiSuccessResponse } from '../../common/decorators/api-success-response.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Role } from '../../common/enums/role.enum';
import { Auth } from '../auth/decorators/auth.decorator';
import { AdminDashboardService } from './admin-dashboard.service';
import {
  ADMIN_DASHBOARD_API_TAG,
  ADMIN_DASHBOARD_ROUTE,
  DASHBOARD_MESSAGES,
} from './constants/admin-dashboard.constants';
import { DashboardOverviewDto, UserOverviewDto } from './dto/admin-dashboard-response.dto';
import type { DashboardOverview, UserOverview } from './interfaces/admin-dashboard.interface';

/**
 * Admin dashboard. It only combines what the users, catalog, history and wallet modules already report; day-to-day
 * management still happens through their own admin APIs (see the README for the full map).
 */
@ApiTags(ADMIN_DASHBOARD_API_TAG)
@Controller(ADMIN_DASHBOARD_ROUTE)
@Auth(Role.ADMIN)
export class AdminDashboardController {
  constructor(private readonly dashboardService: AdminDashboardService) {}

  @Get()
  @ResponseMessage(DASHBOARD_MESSAGES.OVERVIEW)
  @ApiOperation({
    summary: 'Dashboard overview',
    description:
      'Users (active / suspended), games (installed / published / unpublished / disabled), sessions and completed rounds, ' +
      'credits wagered and won, credits in circulation and the ledger balance check, per-game activity, and the latest ' +
      'registrations, game activity and wallet transactions.',
  })
  @ApiSuccessResponse(DashboardOverviewDto, 'The dashboard')
  getOverview(): Promise<DashboardOverview> {
    return this.dashboardService.getOverview();
  }

  @Get('users/:userId')
  @ResponseMessage(DASHBOARD_MESSAGES.USER_OVERVIEW)
  @ApiOperation({
    summary: "One player at a glance (`:userId` is the player's user id)",
    description:
      'Account and registration details, wallet, play activity and statistics, and the latest rounds and wallet transactions. ' +
      'For the full history use /admin/game-history/users/:userId and /admin/wallet-transactions?userId=...',
  })
  @ApiSuccessResponse(UserOverviewDto, 'The player overview')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  getUserOverview(@Param('userId', ParseUUIDPipe) userId: string): Promise<UserOverview> {
    return this.dashboardService.getUserOverview(userId);
  }
}
