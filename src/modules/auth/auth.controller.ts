import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiSuccessResponse } from '../../common/decorators/api-success-response.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { ApiErrorResponseDto, ApiResponseDto } from '../../common/dto/api-response.dto';
import { UserResponseDto } from '../users/dto/user-response.dto';
import type { SafeUser } from '../users/interfaces/user.interface';
import { AuthService } from './auth.service';
import { AUTH_API_TAG, AUTH_MESSAGES, AUTH_ROUTE } from './constants/auth.constants';
import { Auth } from './decorators/auth.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthResponseDto, AuthTokensDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthSession, AuthTokens } from './interfaces/auth-session.interface';

@ApiTags(AUTH_API_TAG)
@Controller(AUTH_ROUTE)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ResponseMessage(AUTH_MESSAGES.REGISTERED)
  @ApiOperation({ summary: 'Register a new user and sign them in' })
  @ApiSuccessResponse(AuthResponseDto, 'User created', HttpStatus.CREATED)
  @ApiBadRequestResponse({ description: 'Validation failed', type: ApiErrorResponseDto })
  @ApiConflictResponse({ description: 'Email is already registered', type: ApiErrorResponseDto })
  register(@Body() dto: RegisterDto): Promise<AuthSession> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(AUTH_MESSAGES.LOGGED_IN)
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiSuccessResponse(AuthResponseDto, 'Login successful')
  @ApiBadRequestResponse({ description: 'Validation failed', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password', type: ApiErrorResponseDto })
  login(@Body() dto: LoginDto): Promise<AuthSession> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(AUTH_MESSAGES.TOKENS_REFRESHED)
  @ApiOperation({
    summary: 'Exchange a refresh token for a new token pair',
    description:
      'Refresh tokens are single-use: the submitted token is revoked and a new one is returned. ' +
      'Re-using an already rotated token revokes the whole session.',
  })
  @ApiSuccessResponse(AuthTokensDto, 'New token pair')
  @ApiBadRequestResponse({ description: 'Validation failed', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Invalid, expired or revoked refresh token',
    type: ApiErrorResponseDto,
  })
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokens> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(AUTH_MESSAGES.LOGGED_OUT)
  @ApiOperation({
    summary: 'Log out by revoking the session of a refresh token',
    description: 'Idempotent. `data` is `null`.',
  })
  @ApiOkResponse({ description: 'Session revoked', type: ApiResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed', type: ApiErrorResponseDto })
  async logout(@Body() dto: RefreshTokenDto): Promise<null> {
    await this.authService.logout(dto.refreshToken);
    return null;
  }

  @Get('me')
  @Auth()
  @ResponseMessage(AUTH_MESSAGES.PROFILE_FETCHED)
  @ApiOperation({ summary: 'Get the currently authenticated user' })
  @ApiSuccessResponse(UserResponseDto, 'Current user')
  me(@CurrentUser() user: SafeUser): SafeUser {
    return user;
  }
}
