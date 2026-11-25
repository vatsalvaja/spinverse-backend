import { plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  MinLength,
  Min,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

const SECRET_MESSAGE =
  'must be a unique random secret of at least 32 characters (do not keep the CHANGE_ME placeholder)';
const DURATION_PATTERN = /^[1-9]\d*[smhd]$/;
const DURATION_MESSAGE = 'must be a number followed by s, m, h or d (e.g. 15m, 7d)';

/**
 * Describes and validates every environment variable the app relies on.
 * The app refuses to boot when a variable is missing or malformed.
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 4000;

  @IsString()
  API_PREFIX: string = 'api/v1';

  @IsString()
  CORS_ORIGINS: string = 'http://localhost:3000';

  @IsBoolean()
  SWAGGER_ENABLED: boolean = true;

  @IsString()
  @IsNotEmpty()
  SWAGGER_PATH: string = 'docs';

  @IsString()
  @Matches(/^postgres(ql)?:\/\//, {
    message: 'DATABASE_URL must be a PostgreSQL connection string (postgresql://...)',
  })
  DATABASE_URL!: string;

  @IsString()
  @MinLength(32, { message: SECRET_MESSAGE })
  @Matches(/^(?!CHANGE_ME)/, { message: SECRET_MESSAGE })
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @MinLength(32, { message: SECRET_MESSAGE })
  @Matches(/^(?!CHANGE_ME)/, { message: SECRET_MESSAGE })
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @Matches(DURATION_PATTERN, { message: DURATION_MESSAGE })
  JWT_ACCESS_EXPIRES_IN: string = '15m';

  @IsString()
  @Matches(DURATION_PATTERN, { message: DURATION_MESSAGE })
  JWT_REFRESH_EXPIRES_IN: string = '7d';

  @IsInt()
  @Min(10)
  @Max(15)
  BCRYPT_SALT_ROUNDS: number = 12;

  /** Where uploaded game packages are stored. Must not be inside any publicly served folder. */
  @IsString()
  @IsNotEmpty()
  PACKAGE_STORAGE_DIR: string = './storage/game-packages';

  /** How long a game launch link stays valid. */
  @IsString()
  @Matches(DURATION_PATTERN, { message: DURATION_MESSAGE })
  GAME_LAUNCH_EXPIRES_IN: string = '4h';
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
    exposeDefaultValues: true,
  });

  // Env values are strings; coerce the non-string ones explicitly.
  if (typeof config.PORT === 'string') validated.PORT = Number(config.PORT);
  if (typeof config.SWAGGER_ENABLED === 'string') {
    validated.SWAGGER_ENABLED = config.SWAGGER_ENABLED.toLowerCase() === 'true';
  }

  if (typeof config.BCRYPT_SALT_ROUNDS === 'string') {
    validated.BCRYPT_SALT_ROUNDS = Number(config.BCRYPT_SALT_ROUNDS);
  }

  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors
      .map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  if (validated.JWT_ACCESS_SECRET === validated.JWT_REFRESH_SECRET) {
    throw new Error(
      'Invalid environment configuration:\n  - JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different',
    );
  }

  return validated;
}
