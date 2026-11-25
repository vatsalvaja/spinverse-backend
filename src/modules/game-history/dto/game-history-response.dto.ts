import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionResponseDto } from '../../demo-wallet/dto/wallet-response.dto';
import { RoundOutcome } from '../enums/round-outcome.enum';

export class UserSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;
}

export class RoundHistoryItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  sessionId: string;

  @ApiProperty()
  userId: string;

  @ApiPropertyOptional({ type: UserSummaryDto, description: 'Admin views only' })
  user?: UserSummaryDto;

  @ApiProperty({ example: 'roulette', description: 'Public game id' })
  gameId: string;

  @ApiProperty({ example: 'Roulette' })
  gameName: string;

  @ApiProperty()
  roundNumber: number;

  @ApiProperty({ enum: ['IN_PROGRESS', 'SETTLED'] })
  status: string;

  @ApiProperty({ enum: RoundOutcome, nullable: true, description: 'null while the round is in progress' })
  outcome: RoundOutcome | null;

  @ApiProperty({ description: 'Credits wagered' })
  stake: number;

  @ApiProperty({ description: 'Credits paid out' })
  payout: number;

  @ApiProperty({ description: 'payout - stake' })
  net: number;

  @ApiProperty()
  balanceBefore: number;

  @ApiProperty()
  balanceAfter: number;

  @ApiProperty({ example: '1.0.0', description: 'Version of the game algorithm that produced the result' })
  engineVersion: string;

  @ApiProperty({ type: String, nullable: true, example: '1.2.0', description: 'Game package version played' })
  packageVersion: string | null;

  @ApiProperty()
  startedAt: Date;

  @ApiProperty({ type: Date, nullable: true })
  settledAt: Date | null;

  @ApiProperty({ type: Number, nullable: true })
  durationMs: number | null;
}

class WalletRoundSummaryDto {
  @ApiProperty({ description: 'Credits taken as the entry cost' })
  entryDebits: number;

  @ApiProperty({ description: 'Credits paid as winnings (all steps of a multi-step round added together)' })
  winnings: number;

  @ApiProperty({ description: 'Credits given back by refunds' })
  refunds: number;

  @ApiProperty({ description: 'winnings + refunds - entryDebits' })
  net: number;
}

class RoundWalletDto {
  @ApiProperty({ type: [TransactionResponseDto], description: 'Every wallet ledger entry this round caused' })
  transactions: TransactionResponseDto[];

  @ApiProperty({ type: WalletRoundSummaryDto })
  summary: WalletRoundSummaryDto;
}

export class RoundHistoryDetailDto extends RoundHistoryItemDto {
  @ApiProperty({ type: 'object', additionalProperties: true, description: 'The bet as validated by the server' })
  bet: Record<string, unknown>;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'The authoritative result as stored when the round was played. Its shape depends on the game.',
  })
  result: Record<string, unknown>;

  @ApiProperty({ description: 'Fingerprint of the round seed' })
  seedCommitment: string;

  @ApiProperty({ type: RoundWalletDto })
  wallet: RoundWalletDto;
}

export class GameBreakdownDto {
  @ApiProperty({ example: 'tiger-clash' })
  gameId: string;

  @ApiProperty()
  gameName: string;

  @ApiProperty()
  games: number;

  @ApiProperty()
  wins: number;

  @ApiProperty()
  losses: number;

  @ApiProperty()
  even: number;

  @ApiProperty()
  wagered: number;

  @ApiProperty()
  winnings: number;

  @ApiProperty()
  net: number;
}

export class HistoryStatsDto {
  @ApiProperty({ description: 'Settled (completed) rounds' })
  totalGames: number;

  @ApiProperty()
  wins: number;

  @ApiProperty()
  losses: number;

  @ApiProperty({ description: 'Paid exactly the stake (includes free spins that won nothing)' })
  even: number;

  @ApiProperty({ description: 'Rounds still open (not counted above)' })
  inProgress: number;

  @ApiProperty()
  wagered: number;

  @ApiProperty()
  winnings: number;

  @ApiProperty({ description: 'winnings - wagered' })
  net: number;

  @ApiProperty({ description: 'wins / totalGames (0 to 1)' })
  winRate: number;

  @ApiProperty()
  averageStake: number;

  @ApiProperty({ description: 'The largest payout of a single round' })
  biggestPayout: number;

  @ApiProperty({ type: [GameBreakdownDto] })
  perGame: GameBreakdownDto[];

  @ApiProperty({ type: 'object', additionalProperties: true, description: '{ from, to } of the filter used' })
  range: { from: Date | null; to: Date | null };
}
