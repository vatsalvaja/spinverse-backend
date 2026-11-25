import { SafeUser } from '../../users/interfaces/user.interface';

/** Tokens returned to the client. */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  /** Access-token lifetime in seconds. */
  expiresIn: number;
}

/** Result of register / login. */
export interface AuthSession {
  user: SafeUser;
  tokens: AuthTokens;
}

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
