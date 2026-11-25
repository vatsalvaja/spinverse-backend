import { ApiProperty } from '@nestjs/swagger';
import { GameOrientation } from '../enums/game-orientation.enum';
import { GamePlatform } from '../enums/game-platform.enum';
import { GameVisibility } from '../enums/game-visibility.enum';

export class GameConfigResponseDto {
  @ApiProperty({ enum: GameVisibility })
  visibility: GameVisibility;

  @ApiProperty()
  featured: boolean;

  @ApiProperty()
  displayOrder: number;

  @ApiProperty({ enum: GameOrientation })
  orientation: GameOrientation;

  @ApiProperty({ enum: GamePlatform, isArray: true })
  platforms: GamePlatform[];

  @ApiProperty({ type: String, nullable: true })
  minClientVersion: string | null;

  @ApiProperty({ type: 'object', additionalProperties: true })
  settings: Record<string, unknown>;
}
