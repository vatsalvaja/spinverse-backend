import { Body, Controller, Get, HttpStatus, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator';
import { ApiSuccessResponse } from '../../common/decorators/api-success-response.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { USERS_API_TAG, USERS_ROUTE, USER_MESSAGES } from './constants/users.constants';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserResponseDto } from './dto/user-response.dto';
import type { SafeUser } from './interfaces/user.interface';
import { UsersService } from './users.service';

/** Self-service profile endpoints for any signed-in user. */
@ApiTags(USERS_API_TAG)
@Controller(USERS_ROUTE)
@Auth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ResponseMessage(USER_MESSAGES.PROFILE_FETCHED)
  @ApiOperation({ summary: 'Get my profile' })
  @ApiSuccessResponse(UserResponseDto, 'The signed-in user')
  getProfile(@CurrentUser() user: SafeUser): Promise<SafeUser> {
    return this.usersService.getProfile(user.id);
  }

  @Patch('profile')
  @ResponseMessage(USER_MESSAGES.PROFILE_UPDATED)
  @ApiOperation({
    summary: 'Update my profile',
    description: 'Only the display name can be changed. Role, email and status are managed by admins.',
  })
  @ApiSuccessResponse(UserResponseDto, 'The updated user')
  @ApiErrors(HttpStatus.BAD_REQUEST)
  updateProfile(
    @CurrentUser() user: SafeUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<SafeUser> {
    return this.usersService.updateProfile(user.id, dto);
  }
}
