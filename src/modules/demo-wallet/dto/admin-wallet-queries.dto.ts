import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { SEARCH_MAX_LENGTH } from '../../../common/constants/validation.constants';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { SortOrder } from '../../../common/enums/sort-order.enum';
import { trimString } from '../../../common/utils/normalize.util';
import { WalletSortField } from '../enums/wallet-sort-field.enum';
import { WalletStatus } from '../enums/wallet-status.enum';

export class ListWalletsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Case-insensitive match on the player name or e-mail' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(SEARCH_MAX_LENGTH)
  search?: string;

  @ApiPropertyOptional({ enum: WalletStatus })
  @IsOptional()
  @IsEnum(WalletStatus)
  status?: WalletStatus;

  @ApiPropertyOptional({ enum: WalletSortField, default: WalletSortField.CreatedAt })
  @IsOptional()
  @IsEnum(WalletSortField)
  sortBy: WalletSortField = WalletSortField.CreatedAt;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.Desc })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder: SortOrder = SortOrder.Desc;
}

export class WalletStatsQueryDto {
  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'Count ledger entries at or after this time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'Count ledger entries at or before this time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}
