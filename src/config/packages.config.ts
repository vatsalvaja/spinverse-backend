import { isAbsolute, resolve } from 'node:path';
import { registerAs } from '@nestjs/config';
import { validateEnv } from './env.validation';

export interface PackagesConfig {
  /** Absolute path of the package storage root. */
  storageDir: string;
  launchExpiresIn: string;
}

export const PACKAGES_CONFIG_KEY = 'packages';

/** Typed package settings: `configService.get<PackagesConfig>('packages')`. */
export const packagesConfig = registerAs(PACKAGES_CONFIG_KEY, (): PackagesConfig => {
  const env = validateEnv(process.env);

  return {
    storageDir: isAbsolute(env.PACKAGE_STORAGE_DIR)
      ? env.PACKAGE_STORAGE_DIR
      : resolve(process.cwd(), env.PACKAGE_STORAGE_DIR),
    launchExpiresIn: env.GAME_LAUNCH_EXPIRES_IN,
  };
});
