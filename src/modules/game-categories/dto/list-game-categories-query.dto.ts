import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { SEARCH_MAX_LENGTH } from '../../../common/constants/validation.constants';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { SortOrder } from '../../../common/enums/sort-order.enum';
import { toBoolean, trimString } from '../../../common/utils/normalize.util';
import { GameCategorySortField } from '../enums/game-category-sort-field.enum';

export class ListGameCategoriesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Case-insensitive match on name or slug' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(SEARCH_MAX_LENGTH)
  search?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Filter by status (ignored on the player-facing endpoint, which only shows active categories)',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: GameCategorySortField, default: GameCategorySortField.DisplayOrder })
  @IsOptional()
  @IsEnum(GameCategorySortField)
  sortBy: GameCategorySortField = GameCategorySortField.DisplayOrder;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.Asc })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder: SortOrder = SortOrder.Asc;
}
