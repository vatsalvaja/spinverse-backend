import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SEMVER_PATTERN, SLUG_PATTERN } from '../../../common/constants/validation.constants';
import { OptionalNotNull } from '../../../common/decorators/optional-not-null.decorator';
import { normalizeSlug, trimString } from '../../../common/utils/normalize.util';
import {
  GAME_DEFAULT_VERSION,
  GAME_DESCRIPTION_MAX_LENGTH,
  GAME_DEVELOPER_MAX_LENGTH,
  GAME_ID_MAX_LENGTH,
  GAME_ID_MIN_LENGTH,
  GAME_NAME_MAX_LENGTH,
  GAME_NAME_MIN_LENGTH,
  GAME_THUMBNAIL_MAX_LENGTH,
  THUMBNAIL_PATTERN,
} from '../constants/games.constants';

/** Creates a game in DRAFT status. Use the config endpoint for visibility, order, platforms, etc. */
export class CreateGameDto {
  @ApiProperty({
    example: 'dragon-vault',
    description: 'Unique, immutable, lower-case identifier (letters, digits, single hyphens)',
    minLength: GAME_ID_MIN_LENGTH,
    maxLength: GAME_ID_MAX_LENGTH,
  })
  @Transform(normalizeSlug)
  @IsString()
  @MinLength(GAME_ID_MIN_LENGTH)
  @MaxLength(GAME_ID_MAX_LENGTH)
  @Matches(SLUG_PATTERN, {
    message: 'gameId must be lower-case words separated by single hyphens (e.g. dragon-vault)',
  })
  gameId: string;

  @ApiProperty({ example: 'Dragon Vault' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MinLength(GAME_NAME_MIN_LENGTH)
  @MaxLength(GAME_NAME_MAX_LENGTH)
  name: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: GAME_DESCRIPTION_MAX_LENGTH })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(GAME_DESCRIPTION_MAX_LENGTH)
  description?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'SPINVERSE Studio' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(GAME_DEVELOPER_MAX_LENGTH)
  developer?: string | null;

  @ApiProperty({ description: 'Id of an active game category' })
  @IsUUID()
  categoryId: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'assets/thumbnail.webp',
    description: 'Reference to the thumbnail (relative path, asset key or http(s) URL)',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(GAME_THUMBNAIL_MAX_LENGTH)
  @Matches(THUMBNAIL_PATTERN, { message: 'thumbnail must not contain spaces or a script-like scheme' })
  thumbnail?: string | null;

  @ApiPropertyOptional({ example: GAME_DEFAULT_VERSION, default: GAME_DEFAULT_VERSION })
  @OptionalNotNull()
  @IsString()
  @Matches(SEMVER_PATTERN, { message: 'version must look like 1.0.0' })
  version?: string;
}
