import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { SEARCH_MAX_LENGTH } from '../../../common/constants/validation.constants';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { SortOrder } from '../../../common/enums/sort-order.enum';
import { toBoolean, trimString } from '../../../common/utils/normalize.util';
import { GameSortField } from '../enums/game-sort-field.enum';
import { GameStatus } from '../enums/game-status.enum';
import { GameVisibility } from '../enums/game-visibility.enum';

/** Admin list filters. */
export class ListGamesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Case-insensitive match on name or game id' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(SEARCH_MAX_LENGTH)
  search?: string;

  @ApiPropertyOptional({ enum: GameStatus })
  @IsOptional()
  @IsEnum(GameStatus)
  status?: GameStatus;

  @ApiPropertyOptional({ enum: GameVisibility })
  @IsOptional()
  @IsEnum(GameVisibility)
  visibility?: GameVisibility;

  @ApiPropertyOptional({ description: 'Filter by category id' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

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
