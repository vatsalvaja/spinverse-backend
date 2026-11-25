import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { AUTH_ERRORS, BEARER_TOKEN_TYPE } from '../constants/auth.constants';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import { TokenService } from '../token.service';

/**
 * Requires a valid access token. The user is re-loaded from the database on every
 * request so deactivated accounts and role changes take effect immediately.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const token = this.extractBearerToken(request.headers.authorization);
    if (!token) throw new UnauthorizedException(AUTH_ERRORS.AUTHENTICATION_REQUIRED);

    const payload = await this.tokenService.verifyAccessToken(token);
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) throw new UnauthorizedException(AUTH_ERRORS.INVALID_TOKEN);

    request.user = user;
    return true;
  }

  private extractBearerToken(header?: string): string | undefined {
    const [scheme, token] = header?.split(' ') ?? [];
    return scheme?.toLowerCase() === BEARER_TOKEN_TYPE.toLowerCase() && token ? token : undefined;
  }
}
