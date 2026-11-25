import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RefreshToken, User } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuthConfig } from '../../config/auth.config';
import { Role } from '../../common/enums/role.enum';
import { CreateUserData, SafeUser } from '../users/interfaces/user.interface';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { CreateRefreshTokenData } from './interfaces/auth-session.interface';
import { PasswordService } from './password.service';
import { RefreshTokenRepository } from './refresh-token.repository';
import { TokenService } from './token.service';

const AUTH_CONFIG: AuthConfig = {
  accessSecret: 'a'.repeat(40),
  accessExpiresIn: '15m',
  refreshSecret: 'b'.repeat(40),
  refreshExpiresIn: '7d',
  bcryptSaltRounds: 4, // fast for tests
};
const configService = { getOrThrow: () => AUTH_CONFIG } as unknown as ConfigService;

/** In-memory stand-in for UsersService + UsersRepository. */
class FakeUsersService {
  readonly records: User[] = [];

  async findById(id: string): Promise<SafeUser | null> {
    const record = this.records.find((u) => u.id === id);
    return record ? this.strip(record) : null;
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.records.find((u) => u.email === email) ?? null;
  }

  async create(data: CreateUserData): Promise<SafeUser> {
    if (this.records.some((u) => u.email === data.email)) {
      throw new ConflictException('Email is already registered');
    }
    const now = new Date();
    const record: User = {
      id: randomUUID(),
      ...data,
      role: Role.USER,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    this.records.push(record);
    return this.strip(record);
  }

  private strip({ passwordHash: _omit, ...user }: User): SafeUser {
    return user;
  }
}

/** In-memory stand-in for RefreshTokenRepository. */
class FakeRefreshTokenRepository {
  readonly rows: RefreshToken[] = [];

  async create(data: CreateRefreshTokenData): Promise<RefreshToken> {
    const row: RefreshToken = { id: randomUUID(), revokedAt: null, createdAt: new Date(), ...data };
    this.rows.push(row);
    return row;
  }

  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.rows.find((r) => r.tokenHash === tokenHash) ?? null;
  }

  async rotate(currentId: string, next: CreateRefreshTokenData): Promise<RefreshToken | null> {
    const current = this.rows.find((r) => r.id === currentId);
    if (!current || current.revokedAt) return null;
    current.revokedAt = new Date();
    return this.create(next);
  }

  async revokeFamily(familyId: string): Promise<void> {
    for (const row of this.rows) {
      if (row.familyId === familyId && !row.revokedAt) row.revokedAt = new Date();
    }
  }
}

const REGISTER = { name: 'Jane Doe', email: 'jane@example.com', password: 'Str0ngPassword' };

describe('AuthService', () => {
  let users: FakeUsersService;
  let refreshTokens: FakeRefreshTokenRepository;
  let tokenService: TokenService;
  let service: AuthService;

  beforeEach(() => {
    users = new FakeUsersService();
    refreshTokens = new FakeRefreshTokenRepository();
    tokenService = new TokenService(new JwtService(), configService);
    service = new AuthService(
      users as unknown as UsersService,
      new PasswordService(configService),
      tokenService,
      refreshTokens as unknown as RefreshTokenRepository,
    );
  });

  describe('register', () => {
    it('creates a USER, hashes the password and returns tokens', async () => {
      const { user, tokens } = await service.register(REGISTER);

      assert.equal(user.email, REGISTER.email);
      assert.equal(user.role, Role.USER);
      assert.ok(!('passwordHash' in user), 'response must not expose the password hash');

      const stored = users.records[0];
      assert.notEqual(stored.passwordHash, REGISTER.password);
      assert.match(stored.passwordHash, /^\$2[aby]\$/, 'password is a bcrypt hash');

      assert.equal(tokens.tokenType, 'Bearer');
      assert.equal(tokens.expiresIn, 900);
      const payload = await tokenService.verifyAccessToken(tokens.accessToken);
      assert.equal(payload.sub, user.id);
      assert.equal(payload.role, Role.USER);
    });

    it('stores only a hash of the refresh token', async () => {
      const { tokens } = await service.register(REGISTER);

      assert.equal(refreshTokens.rows.length, 1);
      const [row] = refreshTokens.rows;
      assert.notEqual(row.tokenHash, tokens.refreshToken);
      assert.equal(row.tokenHash, tokenService.hashToken(tokens.refreshToken));
      assert.ok(!JSON.stringify(row).includes(tokens.refreshToken));
      assert.ok(row.expiresAt.getTime() > Date.now());
    });

    it('rejects a duplicate email with 409', async () => {
      await service.register(REGISTER);
      await assert.rejects(service.register(REGISTER), ConflictException);
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await service.register(REGISTER);
      refreshTokens.rows.length = 0;
    });

    it('returns user and tokens for correct credentials', async () => {
      const { user, tokens } = await service.login({
        email: REGISTER.email,
        password: REGISTER.password,
      });
      assert.equal(user.email, REGISTER.email);
      assert.ok(tokens.accessToken && tokens.refreshToken);
      assert.equal(refreshTokens.rows.length, 1);
    });

    it('uses the same 401 for wrong password, unknown email and disabled account', async () => {
      const messages: string[] = [];
      const attempt = async (email: string, password: string) => {
        try {
          await service.login({ email, password });
          assert.fail('login should have failed');
        } catch (error) {
          assert.ok(error instanceof UnauthorizedException);
          messages.push(error.message);
        }
      };

      await attempt(REGISTER.email, 'WrongPassword1');
      await attempt('nobody@example.com', REGISTER.password);
      users.records[0].isActive = false;
      await attempt(REGISTER.email, REGISTER.password);

      assert.equal(new Set(messages).size, 1);
      assert.equal(messages[0], 'Invalid email or password');
    });
  });

  describe('refresh', () => {
    it('rotates: returns a new pair and revokes the used token', async () => {
      const { tokens } = await service.register(REGISTER);
      const rotated = await service.refresh(tokens.refreshToken);

      assert.notEqual(rotated.refreshToken, tokens.refreshToken);
      assert.ok(rotated.accessToken);
      assert.equal(refreshTokens.rows.length, 2);
      assert.ok(refreshTokens.rows[0].revokedAt, 'old token revoked');
      assert.equal(refreshTokens.rows[1].revokedAt, null, 'new token active');
      assert.equal(refreshTokens.rows[0].familyId, refreshTokens.rows[1].familyId);

      // The new token can be rotated again.
      await service.refresh(rotated.refreshToken);
    });

    it('treats re-use of a rotated token as theft and revokes the whole session', async () => {
      const { tokens } = await service.register(REGISTER);
      const rotated = await service.refresh(tokens.refreshToken);

      await assert.rejects(service.refresh(tokens.refreshToken), UnauthorizedException);
      // The legitimately issued token is now dead too.
      await assert.rejects(service.refresh(rotated.refreshToken), UnauthorizedException);
      assert.ok(refreshTokens.rows.every((r) => r.revokedAt));
    });

    it('rejects an expired stored token', async () => {
      const { tokens } = await service.register(REGISTER);
      refreshTokens.rows[0].expiresAt = new Date(Date.now() - 1000);
      await assert.rejects(service.refresh(tokens.refreshToken), UnauthorizedException);
    });

    it('rejects garbage, access tokens and unknown (never stored) refresh tokens', async () => {
      const { tokens } = await service.register(REGISTER);
      await assert.rejects(service.refresh('not-a-jwt'), UnauthorizedException);
      await assert.rejects(service.refresh(tokens.accessToken), UnauthorizedException);

      refreshTokens.rows.length = 0;
      await assert.rejects(service.refresh(tokens.refreshToken), UnauthorizedException);
    });

    it('rejects refresh for a disabled account', async () => {
      const { tokens } = await service.register(REGISTER);
      users.records[0].isActive = false;
      await assert.rejects(service.refresh(tokens.refreshToken), UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('revokes the session so the refresh token stops working', async () => {
      const { tokens } = await service.register(REGISTER);
      await service.logout(tokens.refreshToken);

      assert.ok(refreshTokens.rows.every((r) => r.revokedAt));
      await assert.rejects(service.refresh(tokens.refreshToken), UnauthorizedException);
    });

    it('is idempotent and ignores unknown tokens', async () => {
      await service.logout('anything');
      const { tokens } = await service.register(REGISTER);
      await service.logout(tokens.refreshToken);
      await service.logout(tokens.refreshToken);
    });
  });
});

describe('TokenService', () => {
  const tokenService = new TokenService(new JwtService(), configService);
  const user: SafeUser = {
    id: 'user-1',
    name: 'Jane',
    email: 'jane@example.com',
    role: Role.ADMIN,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('puts the role in the access token and verifies it', async () => {
    const { tokens } = await tokenService.issueTokens(user);
    const payload = await tokenService.verifyAccessToken(tokens.accessToken);
    assert.equal(payload.role, Role.ADMIN);
  });

  it('does not accept a refresh token as an access token (and vice versa)', async () => {
    const { tokens } = await tokenService.issueTokens(user);
    await assert.rejects(tokenService.verifyAccessToken(tokens.refreshToken), UnauthorizedException);
    await assert.rejects(tokenService.verifyRefreshToken(tokens.accessToken), UnauthorizedException);
  });

  it('rejects tokens signed with a different secret', async () => {
    const forged = await new JwtService().signAsync(
      { sub: user.id, email: user.email, role: Role.ADMIN, type: 'access' },
      { secret: 'x'.repeat(40) },
    );
    await assert.rejects(tokenService.verifyAccessToken(forged), UnauthorizedException);
  });

  it('issues unique refresh tokens even within the same second', async () => {
    const a = await tokenService.issueTokens(user);
    const b = await tokenService.issueTokens(user);
    assert.notEqual(a.tokens.refreshToken, b.tokens.refreshToken);
    assert.notEqual(a.refreshTokenHash, b.refreshTokenHash);
  });
});
