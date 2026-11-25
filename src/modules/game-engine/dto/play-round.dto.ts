import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class PlayRoundDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'The bet. Its shape depends on the game (see GET /game-engines). Examples: ' +
      'slots `{ "bet": 50 }`, Tiger Clash `{ "side": "tiger", "stake": 100 }`, ' +
      'Roulette `{ "bets": [{ "id": "red", "amount": 25 }] }`, ' +
      'SKYFALL `{ "panels": [{ "panel": 0, "stake": 100, "autoCashout": 2.5 }] }`. ' +
      'It is checked against the game rules on the server.',
    example: { bet: 50 },
  })
  @IsObject()
  bet: Record<string, unknown>;
}

export class RoundActionDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'The action. SKYFALL: `{ "type": "CASH_OUT", "panel": 0 }`.',
    example: { type: 'CASH_OUT', panel: 0 },
  })
  @IsObject()
  action: Record<string, unknown>;
}
