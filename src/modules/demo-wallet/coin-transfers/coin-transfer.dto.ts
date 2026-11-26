import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { trimString } from '../../../common/utils/normalize.util';
import { IDEMPOTENCY_KEY_PATTERN } from '../constants/demo-wallet.constants';
import { COIN_ALLOCATION_MAX, COIN_ALLOCATION_MIN, COIN_NOTE_MAX_LENGTH, CoinTransferType } from './coin-transfer.constants';

/** Body of every allocation. There is deliberately no sender, receiver or parent field: those come from the URL and the token. */
export class AllocateCoinsDto {
  @ApiProperty({ example: 20000, minimum: COIN_ALLOCATION_MIN, maximum: COIN_ALLOCATION_MAX, description: 'Coins, at most 2 decimal places' })
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(COIN_ALLOCATION_MIN)
  @Max(COIN_ALLOCATION_MAX)
  amount: number;

  @ApiProperty({
    example: 'alloc-2026-11-30-0001',
    description:
      'Required. Sending the same key again returns the original allocation (`replayed: true`) instead of allocating twice. ' +
      '8-100 characters: letters, digits, . _ : -. Use a fresh key (for example a UUID) for every new allocation.',
  })
  @IsString()
  @Matches(IDEMPOTENCY_KEY_PATTERN, { message: 'idempotencyKey must be 8-100 characters: letters, digits, . _ : -' })
  idempotencyKey: string;

  @ApiPropertyOptional({ example: 'Weekly top-up', maxLength: COIN_NOTE_MAX_LENGTH })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(COIN_NOTE_MAX_LENGTH)
  note?: string;
}

/** Filters for coin-transaction lists. */
export class ListCoinTransfersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CoinTransferType })
  @IsOptional()
  @IsEnum(CoinTransferType)
  type?: CoinTransferType;

  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'Only transfers at or after this time (ISO 8601)' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'Only transfers at or before this time (ISO 8601)' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}

/** Super Admin's system-wide filters. */
export class AdminListCoinTransfersQueryDto extends ListCoinTransfersQueryDto {
  @ApiPropertyOptional({ description: 'Only transfers that belong to this master (user id)' })
  @IsOptional()
  @IsUUID()
  masterId?: string;

  @ApiPropertyOptional({ description: 'Only transfers sent by this account (user id)' })
  @IsOptional()
  @IsUUID()
  senderId?: string;

  @ApiPropertyOptional({ description: 'Only transfers received by this account (user id)' })
  @IsOptional()
  @IsUUID()
  receiverId?: string;
}

export class CoinPartyDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty({ example: 'MASTER' }) role: string;
}

export class CoinTransferResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: CoinTransferType }) type: CoinTransferType;
  @ApiProperty({ example: 5000 }) amount: number;
  @ApiProperty({ type: CoinPartyDto }) sender: CoinPartyDto;
  @ApiProperty({ type: CoinPartyDto }) receiver: CoinPartyDto;
  @ApiProperty({ description: 'The master this movement belongs to' }) masterId: string;
  @ApiProperty({ nullable: true, example: 15000, description: 'Null for MASTER_ALLOCATION (the Super Admin issues coins)' }) senderBalanceAfter: number | null;
  @ApiProperty({ example: 5000 }) receiverBalanceAfter: number;
  @ApiProperty({ nullable: true, description: 'Wallet-ledger entry of the sender debit' }) senderTransactionId: string | null;
  @ApiProperty({ description: 'Wallet-ledger entry of the receiver credit' }) receiverTransactionId: string;
  @ApiProperty({ nullable: true }) note: string | null;
  @ApiProperty() createdAt: Date;
}

export class CoinAllocationResponseDto {
  @ApiProperty({ type: CoinTransferResponseDto }) transfer: CoinTransferResponseDto;
  @ApiProperty({ description: 'True when the idempotency key was used before and nothing new was posted' }) replayed: boolean;
}
