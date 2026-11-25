import { ApiPropertyOptional } from '@nestjs/swagger';
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
import { SEMVER_PATTERN } from '../../../common/constants/validation.constants';
import { OptionalNotNull } from '../../../common/decorators/optional-not-null.decorator';
import { trimString } from '../../../common/utils/normalize.util';
import {
  GAME_DESCRIPTION_MAX_LENGTH,
  GAME_DEVELOPER_MAX_LENGTH,
  GAME_NAME_MAX_LENGTH,
  GAME_NAME_MIN_LENGTH,
  GAME_THUMBNAIL_MAX_LENGTH,
  THUMBNAIL_PATTERN,
} from '../constants/games.constants';

/**
 * Send only the fields to change. `gameId` is immutable and `status` has its own
 * enable / disable endpoints, so neither is accepted here.
 */
export class UpdateGameDto {
  @ApiPropertyOptional({ example: 'Dragon Vault' })
  @OptionalNotNull()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MinLength(GAME_NAME_MIN_LENGTH)
  @MaxLength(GAME_NAME_MAX_LENGTH)
  name?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Send null to clear',
    maxLength: GAME_DESCRIPTION_MAX_LENGTH,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(GAME_DESCRIPTION_MAX_LENGTH)
  description?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Send null to clear' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(GAME_DEVELOPER_MAX_LENGTH)
  developer?: string | null;

  @ApiPropertyOptional({ description: 'Id of an active game category' })
  @OptionalNotNull()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Send null to clear' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(GAME_THUMBNAIL_MAX_LENGTH)
  @Matches(THUMBNAIL_PATTERN, { message: 'thumbnail must not contain spaces or a script-like scheme' })
  thumbnail?: string | null;

  @ApiPropertyOptional({ example: '1.1.0' })
  @OptionalNotNull()
  @IsString()
  @Matches(SEMVER_PATTERN, { message: 'version must look like 1.0.0' })
  version?: string;
}
