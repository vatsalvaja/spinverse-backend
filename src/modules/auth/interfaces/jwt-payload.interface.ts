import { Role } from '../../../common/enums/role.enum';
import { TokenType } from '../enums/token-type.enum';

export interface AccessTokenPayload {
  /** User id. */
  sub: string;
  email: string;
  role: Role;
  type: TokenType.Access;
}

/** Carried in the game launch link; re-checked against the database on every request. */
export interface LaunchTokenPayload {
  /** User id. */
  sub: string;
  /** Public game id (slug). */
  gid: string;
  /** Package version the player was launched into. */
  ver: string;
  type: TokenType.Launch;
}

export interface RefreshTokenPayload {
  /** User id. */
  sub: string;
  /** Unique token id, so two refresh tokens are never identical. */
  jti: string;
  type: TokenType.Refresh;
}
