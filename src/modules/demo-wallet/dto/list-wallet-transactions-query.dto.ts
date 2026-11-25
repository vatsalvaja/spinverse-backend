import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { WalletTransactionDirection } from '../enums/wallet-transaction-direction.enum';
import { WalletTransactionType } from '../enums/wallet-transaction-type.enum';

/** Filters for a player's own transaction history. */
export class ListWalletTransactionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: WalletTransactionType })
  @IsOptional()
  @IsEnum(WalletTransactionType)
  type?: WalletTransactionType;

  @ApiPropertyOptional({ enum: WalletTransactionDirection, description: 'CREDIT = added, DEBIT = taken' })
  @IsOptional()
  @IsEnum(WalletTransactionDirection)
  direction?: WalletTransactionDirection;

  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'Only entries at or after this time (ISO 8601)' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'Only entries at or before this time (ISO 8601)' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}

/** Admin filters: the player's filters plus a user and a game. */
export class AdminListWalletTransactionsQueryDto extends ListWalletTransactionsQueryDto {
  @ApiPropertyOptional({ description: 'Only this player (user id)' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Only entries of this game (game id, uuid)' })
  @IsOptional()
  @IsUUID()
  gameId?: string;
}
