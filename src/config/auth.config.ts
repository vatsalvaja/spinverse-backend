import { registerAs } from '@nestjs/config';
import { validateEnv } from './env.validation';

export interface AuthConfig {
  accessSecret: string;
  accessExpiresIn: string;
  refreshSecret: string;
  refreshExpiresIn: string;
  bcryptSaltRounds: number;
}

export const AUTH_CONFIG_KEY = 'auth';

/** Typed authentication settings: `configService.get<AuthConfig>('auth')`. */
export const authConfig = registerAs(AUTH_CONFIG_KEY, (): AuthConfig => {
  const env = validateEnv(process.env);

  return {
    accessSecret: env.JWT_ACCESS_SECRET,
    accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
    refreshSecret: env.JWT_REFRESH_SECRET,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
    bcryptSaltRounds: env.BCRYPT_SALT_ROUNDS,
  };
});
