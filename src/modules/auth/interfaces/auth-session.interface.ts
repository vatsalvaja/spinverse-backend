import { SafeUser } from '../../users/interfaces/user.interface';

/** Tokens returned to the client. */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  /** Access-token lifetime in seconds. */
  expiresIn: number;
}

/** The master a CLIENT belongs to. */
export interface MasterRef {
  id: string;
  name: string;
  email: string;
}

/** Result of register / login. `master` is set only for a CLIENT (its owning master); null for everyone else. */
export interface AuthSession {
  user: SafeUser;
  /** The account's owning master (CLIENT only). */
  master: MasterRef | null;
  tokens: AuthTokens;
}

/** The signed-in user plus its owning master (`GET /auth/me`). */
export type AuthProfile = SafeUser & { master: MasterRef | null };

/** Freshly signed tokens plus what must be persisted about the refresh token. */
export interface IssuedTokens {
  tokens: AuthTokens;
  refreshTokenHash: string;
  refreshTokenExpiresAt: Date;
}

export interface CreateRefreshTokenData {
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
}
