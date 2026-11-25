import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { SEMVER_PATTERN } from '../../../common/constants/validation.constants';
import { OptionalNotNull } from '../../../common/decorators/optional-not-null.decorator';
import { GAME_DISPLAY_ORDER_MAX } from '../constants/games.constants';
import { GameOrientation } from '../enums/game-orientation.enum';
import { GamePlatform } from '../enums/game-platform.enum';
import { GameVisibility } from '../enums/game-visibility.enum';

/** Send only the settings to change; omitted settings keep their current value. */
export class UpdateGameConfigDto {
  @ApiPropertyOptional({ enum: GameVisibility })
  @OptionalNotNull()
  @IsEnum(GameVisibility)
  visibility?: GameVisibility;

  @ApiPropertyOptional({ description: 'Highlight the game in the catalog' })
  @OptionalNotNull()
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: GAME_DISPLAY_ORDER_MAX })
  @OptionalNotNull()
  @IsInt()
  @Min(0)
  @Max(GAME_DISPLAY_ORDER_MAX)
  displayOrder?: number;

  @ApiPropertyOptional({ enum: GameOrientation })
  @OptionalNotNull()
  @IsEnum(GameOrientation)
  orientation?: GameOrientation;

  @ApiPropertyOptional({ enum: GamePlatform, isArray: true })
  @OptionalNotNull()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(GamePlatform, { each: true })
  platforms?: GamePlatform[];

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '1.0.0',
    description: 'Minimum client version; send null to clear',
  })
  @IsOptional()
  @IsString()
  @Matches(SEMVER_PATTERN, { message: 'minClientVersion must look like 1.0.0' })
  minClientVersion?: string | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Free-form, game-specific settings. Replaces the stored object (max 16 KB).',
    example: { minBet: 1, maxBet: 100 },
  })
  @OptionalNotNull()
  @IsObject()
  settings?: Record<string, unknown>;
}
