import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../../common/enums/role.enum';
import { AUTH_ERRORS, ROLES_KEY } from '../constants/auth.constants';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

/**
 * Enforces `@Roles(...)`. Must run after `JwtAuthGuard` (use `@Auth()`).
 *
 * A SUPER_ADMIN also satisfies `Role.ADMIN`, so the platform owner can use the existing admin console APIs.
 * The reverse is not true: ADMIN never satisfies SUPER_ADMIN, MASTER or CLIENT routes.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const allowed = !!user && (requiredRoles.includes(user.role) || (user.role === Role.SUPER_ADMIN && requiredRoles.includes(Role.ADMIN)));
    if (!allowed) {
      throw new ForbiddenException(AUTH_ERRORS.FORBIDDEN);
    }
    return true;
  }
}
