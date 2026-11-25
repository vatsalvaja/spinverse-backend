export const AUTH_ROUTE = 'auth';
export const AUTH_API_TAG = 'Authentication';

/** Metadata key used by `@Roles()`. */
export const ROLES_KEY = 'roles';

export const BEARER_TOKEN_TYPE = 'Bearer';
export const JWT_ALGORITHM = 'HS256';

export const PASSWORD_MIN_LENGTH = 8;
/** bcrypt ignores everything beyond 72 bytes, so longer passwords are rejected. */
export const PASSWORD_MAX_LENGTH = 72;

export const AUTH_MESSAGES = {
  REGISTERED: 'Registration successful',
  LOGGED_IN: 'Login successful',
  TOKENS_REFRESHED: 'Tokens refreshed successfully',
  LOGGED_OUT: 'Logged out successfully',
  PROFILE_FETCHED: 'Current user fetched successfully',
} as const;

/** One wording per failure type so clients (and attackers) learn nothing extra. */
export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: 'Invalid email or password',
  AUTHENTICATION_REQUIRED: 'Authentication required',
  INVALID_TOKEN: 'Invalid or expired token',
  INVALID_REFRESH_TOKEN: 'Invalid or expired refresh token',
  FORBIDDEN: 'You do not have permission to access this resource',
} as const;
