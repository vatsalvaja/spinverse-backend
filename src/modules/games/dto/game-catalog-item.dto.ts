import { ApiProperty } from '@nestjs/swagger';
import { GameOrientation } from '../enums/game-orientation.enum';
import { GamePlatform } from '../enums/game-platform.enum';

class CatalogCategoryDto {
  @ApiProperty({ example: 'classic-slots' })
  slug: string;

  @ApiProperty({ example: 'Classic Slots' })
  name: string;
}

/** Player-facing view of a game. */
export class GameCatalogItemDto {
  @ApiProperty({ example: 'pharaohs-fortune' })
  gameId: string;

  @ApiProperty({ example: "Pharaoh's Fortune" })
  name: string;

  @ApiProperty({ type: String, nullable: true })
  description: string | null;

  @ApiProperty({ type: String, nullable: true })
  developer: string | null;

  @ApiProperty({ type: CatalogCategoryDto })
  category: CatalogCategoryDto;

  @ApiProperty({ type: String, nullable: true, example: 'assets/thumbnail.webp' })
  thumbnail: string | null;

  @ApiProperty({ example: '1.0.0' })
  version: string;

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
}
