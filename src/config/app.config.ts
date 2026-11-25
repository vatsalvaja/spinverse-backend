import { registerAs } from '@nestjs/config';
import { NodeEnv, validateEnv } from './env.validation';

export interface AppConfig {
  env: NodeEnv;
  isProduction: boolean;
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
  swagger: {
    enabled: boolean;
    path: string;
  };
}

export const APP_CONFIG_KEY = 'app';

const trimSlashes = (value: string): string => value.replace(/^\/+|\/+$/g, '');

/** Typed, normalised application settings: `configService.get<AppConfig>('app')`. */
export const appConfig = registerAs(APP_CONFIG_KEY, (): AppConfig => {
  const env = validateEnv(process.env);

  return {
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === NodeEnv.Production,
    port: env.PORT,
    apiPrefix: trimSlashes(env.API_PREFIX),
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    swagger: {
      enabled: env.SWAGGER_ENABLED,
      path: trimSlashes(env.SWAGGER_PATH),
    },
  };
});
