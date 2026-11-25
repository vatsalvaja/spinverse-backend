import { createHash, randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { AUTH_CONFIG_KEY, AuthConfig } from '../../config/auth.config';
import { SafeUser } from '../users/interfaces/user.interface';
import {
  AUTH_ERRORS,
  BEARER_TOKEN_TYPE,
  JWT_ALGORITHM,
} from './constants/auth.constants';
import { TokenType } from './enums/token-type.enum';
import { IssuedTokens } from './interfaces/auth-session.interface';
import {
  AccessTokenPayload,
  LaunchTokenPayload,
  RefreshTokenPayload,
} from './interfaces/jwt-payload.interface';

type ExpiresIn = JwtSignOptions['expiresIn'];

@Injectable()
export class TokenService {
  private readonly config: AuthConfig;

  constructor(
    private readonly jwtService: JwtService,
    configService: ConfigService,
  ) {
    this.config = configService.getOrThrow<AuthConfig>(AUTH_CONFIG_KEY);
  }

  /** Signs a new access/refresh pair for `user`. Nothing is persisted here. */
  async issueTokens(user: SafeUser): Promise<IssuedTokens> {
    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: TokenType.Access,
    };
    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      jti: randomUUID(),
      type: TokenType.Refresh,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.config.accessSecret,
        expiresIn: this.config.accessExpiresIn as ExpiresIn,
        algorithm: JWT_ALGORITHM,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.config.refreshSecret,
        expiresIn: this.config.refreshExpiresIn as ExpiresIn,
        algorithm: JWT_ALGORITHM,
      }),
    ]);

    const access = this.jwtService.decode<{ exp: number; iat: number }>(accessToken);
    const refresh = this.jwtService.decode<{ exp: number }>(refreshToken);

    return {
      tokens: {
        accessToken,
        refreshToken,
        tokenType: BEARER_TOKEN_TYPE,
        expiresIn: access.exp - access.iat,
      },
      refreshTokenHash: this.hashToken(refreshToken),
      refreshTokenExpiresAt: new Date(refresh.exp * 1000),
    };
  }

  verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    return this.verify<AccessTokenPayload>(
      token,
      this.config.accessSecret,
      TokenType.Access,
      AUTH_ERRORS.INVALID_TOKEN,
    );
  }

  verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    return this.verify<RefreshTokenPayload>(
      token,
      this.config.refreshSecret,
      TokenType.Refresh,
      AUTH_ERRORS.INVALID_REFRESH_TOKEN,
    );
  }

  /** Signs a game launch token (signed with the access secret; `type` keeps it from acting as an access token). */
  issueLaunchToken(
    payload: Omit<LaunchTokenPayload, 'type'>,
    expiresIn: string,
  ): Promise<string> {
    const claims: LaunchTokenPayload = { ...payload, type: TokenType.Launch };
    return this.jwtService.signAsync(claims, {
      secret: this.config.accessSecret,
      expiresIn: expiresIn as ExpiresIn,
      algorithm: JWT_ALGORITHM,
    });
  }

  verifyLaunchToken(token: string): Promise<LaunchTokenPayload> {
    return this.verify<LaunchTokenPayload>(
      token,
      this.config.accessSecret,
      TokenType.Launch,
      AUTH_ERRORS.INVALID_TOKEN,
    );
  }

  /**
   * SHA-256 digest used to store refresh tokens. A fast hash is correct here: the
   * input is a high-entropy random token (not a guessable password), and bcrypt
   * would only look at the first 72 bytes - the JWT header, identical for all tokens.
   */
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async verify<T extends { type: TokenType }>(
    token: string,
    secret: string,
    expectedType: TokenType,
    errorMessage: string,
  ): Promise<T> {
    try {
      const payload = await this.jwtService.verifyAsync<T>(token, {
        secret,
        algorithms: [JWT_ALGORITHM],
      });
      if (payload.type !== expectedType) throw new Error('Unexpected token type');
      return payload;
    } catch {
      throw new UnauthorizedException(errorMessage);
    }
  }
}
