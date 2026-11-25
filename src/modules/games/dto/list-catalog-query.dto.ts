import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { SEARCH_MAX_LENGTH } from '../../../common/constants/validation.constants';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { SortOrder } from '../../../common/enums/sort-order.enum';
import { normalizeSlug, toBoolean, trimString } from '../../../common/utils/normalize.util';
import { GameSortField } from '../enums/game-sort-field.enum';

/** Player catalog filters. */
export class ListCatalogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Case-insensitive match on name or game id' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(SEARCH_MAX_LENGTH)
  search?: string;

  @ApiPropertyOptional({ description: 'Category slug, e.g. classic-slots' })
  @IsOptional()
  @Transform(normalizeSlug)
  @IsString()
  @IsNotEmpty()
  @MaxLength(SEARCH_MAX_LENGTH)
  category?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({ enum: GameSortField, default: GameSortField.DisplayOrder })
  @IsOptional()
  @IsEnum(GameSortField)
  sortBy: GameSortField = GameSortField.DisplayOrder;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.Asc })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder: SortOrder = SortOrder.Asc;
}
