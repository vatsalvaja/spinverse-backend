import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './user-response.dto';

export class MasterCoinSummaryDto {
  @ApiProperty({ example: 12000, description: 'Spendable balance (the master wallet)' })
  balance: number;

  @ApiProperty({ example: 20000, description: 'Everything the Super Admin ever allocated to this master' })
  totalReceived: number;

  @ApiProperty({ example: 8000, description: 'Net coins handed to clients (allocations minus coins returned from deleted clients)' })
  totalDistributed: number;
}

export class ClientCountDto {
  @ApiProperty({ example: 2 }) total: number;
  @ApiProperty({ example: 2 }) active: number;
}

export class MasterResponseDto extends UserResponseDto {
  @ApiProperty({ type: MasterCoinSummaryDto })
  wallet: MasterCoinSummaryDto;

  @ApiProperty({ type: ClientCountDto })
  clients: ClientCountDto;
}

export class ClientResponseDto extends UserResponseDto {
  @ApiProperty({ example: 5000, description: 'Current coin balance (the client demo wallet used by the games)' })
  balance: number;
}

export class MasterWalletResponseDto extends MasterCoinSummaryDto {
  @ApiProperty() masterId: string;
  @ApiProperty({ type: ClientCountDto }) clients: ClientCountDto;
}

export class ClientBalanceResponseDto {
  @ApiProperty() clientId: string;
  @ApiProperty({ example: 5000 }) balance: number;
}

export class DeleteClientResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: true }) deleted: boolean;
  @ApiProperty({ example: 5000, description: 'Coins that were still in the wallet and went back to the master' }) coinsReturned: number;
}

export class SystemOverviewResponseDto {
  @ApiProperty({ example: { total: 40, active: 38, byRole: { USER: 30, ADMIN: 1, SUPER_ADMIN: 1, MASTER: 2, CLIENT: 6 } } })
  users: { total: number; active: number; byRole: Record<string, number> };

  @ApiProperty({ example: { totalIssued: 20000, totalDistributed: 8000, totalTransfers: 3 } })
  coins: { totalIssued: number; totalDistributed: number; totalTransfers: number };
}
