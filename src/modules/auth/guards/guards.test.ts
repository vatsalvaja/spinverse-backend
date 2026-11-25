import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from '../../../common/enums/role.enum';
import { AuthConfig } from '../../../config/auth.config';
import { SafeUser } from '../../users/interfaces/user.interface';
import { UsersService } from '../../users/users.service';
import { Roles } from '../decorators/roles.decorator';
import { TokenService } from '../token.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

const config: AuthConfig = {
  accessSecret: 'a'.repeat(40),
  accessExpiresIn: '15m',
  refreshSecret: 'b'.repeat(40),
  refreshExpiresIn: '7d',
  bcryptSaltRounds: 4,
};
const tokenService = new TokenService(new JwtService(), {
  getOrThrow: () => config,
} as unknown as ConfigService);

const makeUser = (overrides: Partial<SafeUser> = {}): SafeUser => ({
  id: 'user-1',
  name: 'Jane',
  email: 'jane@example.com',
  role: Role.USER,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

function contextFor(
  request: Record<string, unknown>,
  handler: object = {},
  controller: object = class {},
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => controller,
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  const usersFor = (user: SafeUser | null) =>
    ({ findById: async () => user }) as unknown as UsersService;

  it('rejects requests without a bearer token', async () => {
    const guard = new JwtAuthGuard(tokenService, usersFor(makeUser()));
    for (const authorization of [undefined, '', 'Bearer', 'Basic abc']) {
      await assert.rejects(
        guard.canActivate(contextFor({ headers: { authorization } })),
        UnauthorizedException,
      );
    }
  });

  it('rejects an invalid token and a refresh token', async () => {
    const guard = new JwtAuthGuard(tokenService, usersFor(makeUser()));
    const { tokens } = await tokenService.issueTokens(makeUser());

    for (const token of ['garbage', tokens.refreshToken]) {
      await assert.rejects(
        guard.canActivate(contextFor({ headers: { authorization: `Bearer ${token}` } })),
        UnauthorizedException,
      );
    }
  });

  it('attaches the user for a valid access token', async () => {
    const user = makeUser();
    const guard = new JwtAuthGuard(tokenService, usersFor(user));
    const { tokens } = await tokenService.issueTokens(user);
    const request: Record<string, unknown> = {
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    };

    assert.equal(await guard.canActivate(contextFor(request)), true);
    assert.deepEqual(request.user, user);
  });

  it('rejects a valid token whose user was deleted or deactivated', async () => {
    const { tokens } = await tokenService.issueTokens(makeUser());
    const request = () => ({ headers: { authorization: `Bearer ${tokens.accessToken}` } });

    for (const user of [null, makeUser({ isActive: false })]) {
      const guard = new JwtAuthGuard(tokenService, usersFor(user));
      await assert.rejects(guard.canActivate(contextFor(request())), UnauthorizedException);
    }
  });
});

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  // Apply @Roles(...) to a throw-away handler to exercise real metadata lookup.
  const adminOnly = () => {
    const handler = function adminOnlyHandler() {};
    Roles(Role.ADMIN)(
      {},
      'adminOnlyHandler',
      { value: handler } as TypedPropertyDescriptor<() => void>,
    );
    return handler;
  };

  it('allows any user when no roles are required', () => {
    const context = contextFor({ user: makeUser() }, function open() {});
    assert.equal(guard.canActivate(context), true);
  });

  it('allows a user holding a required role', () => {
    const context = contextFor({ user: makeUser({ role: Role.ADMIN }) }, adminOnly());
    assert.equal(guard.canActivate(context), true);
  });

  it('forbids a user without the required role (403)', () => {
    const context = contextFor({ user: makeUser({ role: Role.USER }) }, adminOnly());
    assert.throws(() => guard.canActivate(context), ForbiddenException);
  });
});
