import { UseGuards, applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../../../common/dto/api-response.dto';
import { Role } from '../../../common/enums/role.enum';
import { AUTH_ERRORS } from '../constants/auth.constants';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';

/**
 * Protects a route (or controller): requires a valid access token and, when roles
 * are given, that the user has one of them. Also documents it in Swagger.
 *
 *   @Auth()              any signed-in user
 *   @Auth(Role.ADMIN)    admins only
 */
export const Auth = (...roles: Role[]): MethodDecorator & ClassDecorator => {
  const decorators = [
    UseGuards(JwtAuthGuard, RolesGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({
      description: AUTH_ERRORS.AUTHENTICATION_REQUIRED,
      type: ApiErrorResponseDto,
    }),
  ];
  if (roles.length > 0) {
    decorators.push(
      Roles(...roles),
      ApiForbiddenResponse({ description: AUTH_ERRORS.FORBIDDEN, type: ApiErrorResponseDto }),
    );
  }
  return applyDecorators(...decorators) as MethodDecorator & ClassDecorator;
};
