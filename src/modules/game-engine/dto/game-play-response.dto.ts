import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SessionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'pharaohs-fortune' })
  gameId: string;

  @ApiProperty({ enum: ['ACTIVE', 'CLOSED', 'EXPIRED'] })
  status: string;

  @ApiProperty()
  roundCount: number;

  @ApiProperty({ description: 'Total demo credits staked in this session' })
  totalStaked: number;

  @ApiProperty({ description: 'Total demo credits paid out in this session' })
  totalPaid: number;

  @ApiProperty()
  startedAt: Date;

  @ApiProperty()
  lastActivityAt: Date;

  @ApiProperty({ type: Date, nullable: true })
  endedAt: Date | null;

  @ApiProperty({ example: '1.0.0', description: 'Version of the game algorithm in use' })
  engineVersion: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'What the game lets you see of its carry-over state, e.g. free spins left',
  })
  state: Record<string, unknown>;

  @ApiProperty({ description: 'Your demo credit balance' })
  balance: number;
}

export class RoundResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  sessionId: string;

  @ApiProperty({ example: 'roulette' })
  gameId: string;

  @ApiProperty()
  roundNumber: number;

  @ApiProperty({ enum: ['IN_PROGRESS', 'SETTLED'] })
  status: string;

  @ApiProperty({ description: 'Demo credits staked' })
  stake: number;

  @ApiProperty({ description: 'Demo credits paid out so far (the total once settled)' })
  payout: number;

  @ApiProperty({ description: 'payout - stake' })
  net: number;

  @ApiProperty({ type: 'object', additionalProperties: true })
  bet: Record<string, unknown>;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'The result decided by the server. Its shape depends on the game (see docs/game-algorithms).',
  })
  result: Record<string, unknown>;

  @ApiProperty({ description: 'SHA-256 of the round seed, fixed before the round was played' })
  seedCommitment: string;

  @ApiProperty({ example: '1.0.0' })
  engineVersion: string;

  @ApiProperty()
  balanceBefore: number;

  @ApiProperty()
  balanceAfter: number;

  @ApiProperty()
  startedAt: Date;

  @ApiProperty({ type: Date, nullable: true })
  settledAt: Date | null;
}

export class RoundAuditResponseDto {
  @ApiProperty()
  roundId: string;

  @ApiProperty()
  gameId: string;

  @ApiProperty()
  engineVersion: string;

  @ApiProperty({ description: 'The secret random seed of the round (hex)' })
  seed: string;

  @ApiProperty({ description: 'sha256 of the seed bytes; was shown when the round started' })
  seedCommitment: string;

  @ApiProperty({ description: 'How many random numbers the round used' })
  rngDraws: number;

  @ApiProperty({ type: 'object', additionalProperties: true })
  bet: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  result: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true, description: 'Private data of the round, e.g. the SKYFALL crash point' })
  roundState: Record<string, unknown>;

  @ApiProperty({ description: 'SHA-256 of the game state before the round (the state itself is shown to admins only)' })
  sessionStateBeforeHash: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, description: 'Admin view only' })
  sessionStateBefore?: Record<string, unknown>;

  @ApiProperty()
  howToVerify: string;
}

export class AdminRoundResponseDto {
  @ApiProperty({ type: RoundResponseDto })
  round: RoundResponseDto;

  @ApiProperty({ type: RoundAuditResponseDto, nullable: true, description: 'Present only once the round is settled' })
  audit: RoundAuditResponseDto | null;
}

export class EngineInfoResponseDto {
  @ApiProperty({ example: 'tiger-clash' })
  gameId: string;

  @ApiProperty({ example: '1.0.0' })
  engineVersion: string;

  @ApiProperty({ type: 'object', additionalProperties: true, description: 'Bet limits and options' })
  rules: Record<string, unknown>;
}
