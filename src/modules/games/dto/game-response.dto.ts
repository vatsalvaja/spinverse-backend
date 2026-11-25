import { ApiProperty } from '@nestjs/swagger';
import { GameCategoryResponseDto } from '../../game-categories/dto/game-category-response.dto';
import { GameOrientation } from '../enums/game-orientation.enum';
import { GamePlatform } from '../enums/game-platform.enum';
import { GameStatus } from '../enums/game-status.enum';
import { GameVisibility } from '../enums/game-visibility.enum';
import { PackageStatus } from '../enums/package-status.enum';

/** Full admin view of a game. */
export class GameResponseDto {
  @ApiProperty({ example: '0b6d1c1e-5c1f-4d5b-9f55-1c6f3c0a8a11' })
  id: string;

  @ApiProperty({ example: 'dragon-vault' })
  gameId: string;

  @ApiProperty({ example: 'Dragon Vault' })
  name: string;

  @ApiProperty({ type: String, nullable: true })
  description: string | null;

  @ApiProperty({ type: String, nullable: true })
  developer: string | null;

  @ApiProperty({ type: GameCategoryResponseDto })
  category: GameCategoryResponseDto;

  @ApiProperty({ type: String, nullable: true, example: 'assets/thumbnail.webp' })
  thumbnail: string | null;

  @ApiProperty({ example: '1.0.0' })
  version: string;

  @ApiProperty({ enum: GameStatus, example: GameStatus.DRAFT })
  status: GameStatus;

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

  @ApiProperty({ description: 'True for games that ship with SPINVERSE' })
  builtIn: boolean;

  @ApiProperty({ type: String, nullable: true, description: 'Entry file inside the installed package' })
  entryPoint: string | null;

  @ApiProperty({ enum: PackageStatus, description: 'Written by the future install workflow' })
  packageStatus: PackageStatus;

  @ApiProperty({ type: String, nullable: true })
  installedVersion: string | null;

  @ApiProperty({ type: Date, nullable: true })
  installedAt: Date | null;

  @ApiProperty({ type: String, nullable: true, description: 'Written by the future publish workflow' })
  publishedVersion: string | null;

  @ApiProperty({ type: Date, nullable: true })
  publishedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
