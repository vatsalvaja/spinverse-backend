import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { trimString } from '../../../common/utils/normalize.util';
import {
  ADJUSTMENT_REASON_MAX_LENGTH,
  ADJUSTMENT_REASON_MIN_LENGTH,
  ADMIN_ADJUSTMENT_MAX,
  ADMIN_ADJUSTMENT_MIN,
  ADMIN_CREDIT_TYPES,
  IDEMPOTENCY_KEY_PATTERN,
} from '../constants/demo-wallet.constants';
import { WalletTransactionType } from '../enums/wallet-transaction-type.enum';

/** An administrative debit of demo credits. Every adjustment needs a meaningful reason (stored in the ledger). */
export class DebitWalletDto {
  @ApiProperty({ example: 250, minimum: ADMIN_ADJUSTMENT_MIN, maximum: ADMIN_ADJUSTMENT_MAX, description: 'Demo credits, at most 2 decimal places' })
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(ADMIN_ADJUSTMENT_MIN)
  @Max(ADMIN_ADJUSTMENT_MAX)
  amount: number;

  @ApiProperty({ example: 'Correction: duplicate promotional credit', minLength: ADJUSTMENT_REASON_MIN_LENGTH })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MinLength(ADJUSTMENT_REASON_MIN_LENGTH)
  @MaxLength(ADJUSTMENT_REASON_MAX_LENGTH)
  reason: string;

  @ApiPropertyOptional({
    example: 'adj-2026-11-28-0001',
    description:
      'Optional but recommended. Sending the same key again returns the original result instead of adjusting twice ' +
      '(8-100 characters: letters, digits, . _ : -).',
  })
  @IsOptional()
  @IsString()
  @Matches(IDEMPOTENCY_KEY_PATTERN, { message: 'idempotencyKey must be 8-100 characters: letters, digits, . _ : -' })
  idempotencyKey?: string;
}

/** An administrative credit of demo credits. */
export class CreditWalletDto extends DebitWalletDto {
  @ApiPropertyOptional({ enum: ADMIN_CREDIT_TYPES, default: WalletTransactionType.ADMIN_CREDIT })
  @IsOptional()
  @IsIn(ADMIN_CREDIT_TYPES)
  type?: WalletTransactionType;
}
