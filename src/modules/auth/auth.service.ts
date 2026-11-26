import { randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { SafeUser } from '../users/interfaces/user.interface';
import { UsersService } from '../users/users.service';
import { AUTH_ERRORS } from './constants/auth.constants';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthProfile, AuthSession, AuthTokens } from './interfaces/auth-session.interface';
import { PasswordService } from './password.service';
import { RefreshTokenRepository } from './refresh-token.repository';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  /** Creates a `USER` account (role is never client-controlled) and signs it in. */
  async register(dto: RegisterDto): Promise<AuthSession> {
    const passwordHash = await this.passwordService.hash(dto.password);
    const user = await this.usersService.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
    });
    return this.startSession(user);
  }

  async login(dto: LoginDto): Promise<AuthSession> {
    const record = await this.usersService.findByEmailWithPassword(dto.email);

    let passwordMatches = false;
    if (record) {
      passwordMatches = await this.passwordService.compare(dto.password, record.passwordHash);
    } else {
      await this.passwordService.compareWithDummy(dto.password);
    }

    // Same error for unknown e-mail, wrong password and disabled account.
    if (!record || !passwordMatches || !record.isActive) {
      throw new UnauthorizedException(AUTH_ERRORS.INVALID_CREDENTIALS);
    }

    const { passwordHash: _passwordHash, ...user } = record;
    return this.startSession(user);
  }

  /**
   * Exchanges a valid refresh token for a new pair (rotation). The presented token
   * is revoked; presenting an already-revoked token is treated as theft and revokes
   * the whole session.
   */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    await this.tokenService.verifyRefreshToken(refreshToken);

    const stored = await this.refreshTokenRepository.findByHash(
      this.tokenService.hashToken(refreshToken),
    );
    if (!stored) throw this.invalidRefreshToken();

    if (stored.revokedAt) {
      await this.refreshTokenRepository.revokeFamily(stored.familyId);
      throw this.invalidRefreshToken();
    }
    if (stored.expiresAt.getTime() <= Date.now()) throw this.invalidRefreshToken();

    const user = await this.usersService.findById(stored.userId);
    if (!user || !user.isActive) throw this.invalidRefreshToken();

    const issued = await this.tokenService.issueTokens(user);
    const rotated = await this.refreshTokenRepository.rotate(stored.id, {
      userId: user.id,
      tokenHash: issued.refreshTokenHash,
      familyId: stored.familyId,
      expiresAt: issued.refreshTokenExpiresAt,
    });
    if (!rotated) {
      // Lost a race with another use of the same token: treat as reuse.
      await this.refreshTokenRepository.revokeFamily(stored.familyId);
      throw this.invalidRefreshToken();
    }

    return issued.tokens;
  }

  /** Revokes the session of the given refresh token. Idempotent: unknown tokens are ignored. */
  async logout(refreshToken: string): Promise<void> {
    const stored = await this.refreshTokenRepository.findByHash(
      this.tokenService.hashToken(refreshToken),
    );
    if (stored) {
      await this.refreshTokenRepository.revokeFamily(stored.familyId);
    }
  }

  /** Starts a new session (token family) and persists only the refresh-token hash. */
  private async startSession(user: SafeUser): Promise<AuthSession> {
    const issued = await this.tokenService.issueTokens(user);
    await this.refreshTokenRepository.create({
      userId: user.id,
      tokenHash: issued.refreshTokenHash,
      familyId: randomUUID(),
      expiresAt: issued.refreshTokenExpiresAt,
    });
    return { user, master: await this.usersService.getParentSummary(user), tokens: issued.tokens };
  }

  /** The signed-in user with its owning master (for a CLIENT), as returned by `GET /auth/me`. */
  async getProfile(user: SafeUser): Promise<AuthProfile> {
    return { ...user, master: await this.usersService.getParentSummary(user) };
  }

  private invalidRefreshToken(): UnauthorizedException {
    return new UnauthorizedException(AUTH_ERRORS.INVALID_REFRESH_TOKEN);
  }
}
