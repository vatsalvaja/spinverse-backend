import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SLUG_PATTERN } from '../../../common/constants/validation.constants';
import { OptionalNotNull } from '../../../common/decorators/optional-not-null.decorator';
import { normalizeSlug, trimString } from '../../../common/utils/normalize.util';
import {
  CATEGORY_DESCRIPTION_MAX_LENGTH,
  CATEGORY_NAME_MAX_LENGTH,
  CATEGORY_NAME_MIN_LENGTH,
  CATEGORY_SLUG_MAX_LENGTH,
  CATEGORY_SLUG_MIN_LENGTH,
  CATEGORY_SORT_ORDER_MAX,
} from '../constants/game-categories.constants';

/** Send only the fields to change. Use the activate / deactivate endpoints for status. */
export class UpdateGameCategoryDto {
  @ApiPropertyOptional({ example: 'Hold & Respin' })
  @OptionalNotNull()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MinLength(CATEGORY_NAME_MIN_LENGTH)
  @MaxLength(CATEGORY_NAME_MAX_LENGTH)
  name?: string;

  @ApiPropertyOptional({ example: 'hold-respin' })
  @OptionalNotNull()
  @Transform(normalizeSlug)
  @IsString()
  @MinLength(CATEGORY_SLUG_MIN_LENGTH)
  @MaxLength(CATEGORY_SLUG_MAX_LENGTH)
  @Matches(SLUG_PATTERN, { message: 'slug must be lower-case words separated by single hyphens' })
  slug?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: CATEGORY_DESCRIPTION_MAX_LENGTH,
    description: 'Send null to clear the description',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(CATEGORY_DESCRIPTION_MAX_LENGTH)
  description?: string | null;

  @ApiPropertyOptional({ minimum: 0, maximum: CATEGORY_SORT_ORDER_MAX })
  @OptionalNotNull()
  @IsInt()
  @Min(0)
  @Max(CATEGORY_SORT_ORDER_MAX)
  sortOrder?: number;
}
