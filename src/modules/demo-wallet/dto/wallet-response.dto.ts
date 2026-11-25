import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WalletStatus } from '../enums/wallet-status.enum';
import { WalletTransactionDirection } from '../enums/wallet-transaction-direction.enum';
import { WalletTransactionType } from '../enums/wallet-transaction-type.enum';

export class WalletResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ example: 5000, description: 'Free demo credits you can spend now. They have no cash value.' })
  balance: number;

  @ApiProperty({ example: 5200, description: 'Everything ever added to this wallet' })
  totalCredited: number;

  @ApiProperty({ example: 200, description: 'Everything ever taken from this wallet' })
  totalDebited: number;

  @ApiProperty({ enum: WalletStatus })
  status: WalletStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class BalanceResponseDto {
  @ApiProperty({ example: 5000 })
  balance: number;

  @ApiProperty({ enum: WalletStatus })
  status: WalletStatus;
}

export class WalletUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  role: string;

  @ApiProperty()
  isActive: boolean;
}

export class AdminWalletResponseDto extends WalletResponseDto {
  @ApiProperty({ type: WalletUserDto })
  user: WalletUserDto;
}

export class TransactionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  walletId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ enum: WalletTransactionType })
  type: WalletTransactionType;

  @ApiProperty({ enum: WalletTransactionDirection })
  direction: WalletTransactionDirection;

  @ApiProperty({ example: 50, description: 'Always positive; the direction says whether it was added or taken' })
  amount: number;

  @ApiProperty()
  balanceBefore: number;

  @ApiProperty()
  balanceAfter: number;

  @ApiProperty({ type: String, nullable: true, description: 'Game id (uuid), for entries that come from play' })
  gameId: string | null;

  @ApiProperty({ type: String, nullable: true })
  sessionId: string | null;

  @ApiProperty({ type: String, nullable: true })
  roundId: string | null;

  @ApiProperty()
  description: string;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional({ description: 'Admin views only' })
  idempotencyKey?: string;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Admin views only: the administrator who made the adjustment' })
  actorId?: string | null;
}

export class AdjustmentResponseDto {
  @ApiProperty({ type: TransactionResponseDto })
  transaction: TransactionResponseDto;

  @ApiProperty({ description: 'The wallet balance after the adjustment' })
  balance: number;

  @ApiProperty({ description: 'True when the idempotency key was already processed and nothing new was posted' })
  replayed: boolean;
}

class WalletCountsDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  active: number;

  @ApiProperty()
  suspended: number;
}

class TypeTotalsDto {
  @ApiProperty({ enum: WalletTransactionType })
  type: WalletTransactionType;

  @ApiProperty({ enum: WalletTransactionDirection })
  direction: WalletTransactionDirection;

  @ApiProperty()
  count: number;

  @ApiProperty()
  totalAmount: number;
}

export class WalletStatsResponseDto {
  @ApiProperty({ type: WalletCountsDto })
  wallets: WalletCountsDto;

  @ApiProperty({ description: 'Demo credits currently held in all wallets' })
  totalBalance: number;

  @ApiProperty()
  totalCredited: number;

  @ApiProperty()
  totalDebited: number;

  @ApiProperty({ description: 'totalCredited - totalDebited - totalBalance; 0 when the books balance' })
  discrepancy: number;

  @ApiProperty({ type: [TypeTotalsDto], description: 'Ledger entries per type (within the date range, if given)' })
  byType: TypeTotalsDto[];

  @ApiProperty({ type: 'object', additionalProperties: true, description: '{ from, to } of the filter used' })
  range: { from: Date | null; to: Date | null };
}
