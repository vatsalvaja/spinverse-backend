import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ADMIN_USERS_API_TAG, ADMIN_USERS_ROUTE, USER_MESSAGES } from './constants/users.constants';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UserResponseDto } from './dto/user-response.dto';
import type { SafeUser } from './interfaces/user.interface';
import { UsersService } from './users.service';
import { AUDIT_ACTIONS, AUDIT_RESOURCES } from '../audit/constants/audit.constants';
import { Audit } from '../audit/decorators/audit.decorator';

/** User administration. Every route requires the ADMIN role. */
@ApiTags(ADMIN_USERS_API_TAG)
@Controller(ADMIN_USERS_ROUTE)
@Auth(Role.ADMIN)
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ResponseMessage(USER_MESSAGES.LISTED)
  @ApiOperation({ summary: 'List users with search, filters, sorting and pagination' })
  @ApiPaginatedResponse(UserResponseDto, 'Paginated users')
  @ApiErrors(HttpStatus.BAD_REQUEST)
  list(@Query() query: ListUsersQueryDto): Promise<PaginatedResult<SafeUser>> {
    return this.usersService.list(query);
  }

  @Get(':id')
  @ResponseMessage(USER_MESSAGES.FETCHED)
  @ApiOperation({ summary: 'Get a user by id' })
  @ApiSuccessResponse(UserResponseDto, 'The user')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  getById(@Param('id', ParseUUIDPipe) id: string): Promise<SafeUser> {
    return this.usersService.getById(id);
  }

  @Patch(':id')
  @ResponseMessage(USER_MESSAGES.UPDATED)
  @Audit({ action: AUDIT_ACTIONS.USER_UPDATED, resourceType: AUDIT_RESOURCES.USER, targetParam: 'id' })
  @ApiOperation({
    summary: 'Update a user (name, email, role)',
    description:
      'Only admins can change roles. An admin cannot change their own role, which guarantees at least one admin remains.',
  })
  @ApiSuccessResponse(UserResponseDto, 'The updated user')
  @ApiErrors(
    HttpStatus.BAD_REQUEST,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND,
    HttpStatus.CONFLICT,
  )
  update(
    @CurrentUser() actor: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateUserDto,
  ): Promise<SafeUser> {
    return this.usersService.adminUpdate(actor, id, dto);
  }

  @Patch(':id/activate')
  @ResponseMessage(USER_MESSAGES.ACTIVATED)
  @Audit({ action: AUDIT_ACTIONS.USER_ACTIVATED, resourceType: AUDIT_RESOURCES.USER, targetParam: 'id' })
  @ApiOperation({ summary: 'Activate a user account' })
  @ApiSuccessResponse(UserResponseDto, 'The activated user')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  activate(
    @CurrentUser() actor: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SafeUser> {
    return this.usersService.setActive(actor, id, true);
  }

  @Patch(':id/deactivate')
  @ResponseMessage(USER_MESSAGES.DEACTIVATED)
  @Audit({ action: AUDIT_ACTIONS.USER_DEACTIVATED, resourceType: AUDIT_RESOURCES.USER, targetParam: 'id' })
  @ApiOperation({
    summary: 'Deactivate a user account',
    description:
      'A deactivated user can no longer log in or use existing tokens. Admins cannot deactivate themselves.',
  })
  @ApiSuccessResponse(UserResponseDto, 'The deactivated user')
  @ApiErrors(HttpStatus.BAD_REQUEST, HttpStatus.FORBIDDEN, HttpStatus.NOT_FOUND)
  deactivate(
    @CurrentUser() actor: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SafeUser> {
    return this.usersService.setActive(actor, id, false);
  }
}
