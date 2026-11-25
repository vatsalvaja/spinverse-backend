import { Game, GameCategory, Prisma } from '@prisma/client';
import { GameOrientation } from '../enums/game-orientation.enum';
import { GamePlatform } from '../enums/game-platform.enum';
import { GameStatus } from '../enums/game-status.enum';
import { GameVisibility } from '../enums/game-visibility.enum';

/** A game together with its category (every repository read includes it). */
export type GameWithCategory = Game & { category: GameCategory };

export interface CreateGameData {
  gameId: string;
  name: string;
  description?: string | null;
  developer?: string | null;
  categoryId: string;
  thumbnail?: string | null;
  version?: string;
}

export interface UpdateGameData {
  name?: string;
  description?: string | null;
  developer?: string | null;
  categoryId?: string;
  thumbnail?: string | null;
  version?: string;
}

export interface UpdateGameConfigData {
  visibility?: GameVisibility;
  featured?: boolean;
  displayOrder?: number;
  orientation?: GameOrientation;
  platforms?: GamePlatform[];
  minClientVersion?: string | null;
  /** Replaces the stored settings object. */
  settings?: Record<string, unknown>;
}

export interface GameListFilter {
  /** Case-insensitive match on name or game id. */
  search?: string;
  status?: GameStatus;
  categoryId?: string;
  categorySlug?: string;
  visibilities?: GameVisibility[];
  featured?: boolean;
  /** Only games whose category is active (player catalog). */
  activeCategoryOnly?: boolean;
}

/** The configuration slice of a game. */
export interface GameConfig {
  visibility: GameVisibility;
  featured: boolean;
  displayOrder: number;
  orientation: GameOrientation;
  platforms: GamePlatform[];
  minClientVersion: string | null;
  settings: Prisma.JsonValue;
}

/** What players see in the catalog: no internal status, settings or package details. */
export interface GameCatalogItem {
  gameId: string;
  name: string;
  description: string | null;
  developer: string | null;
  category: { slug: string; name: string };
  thumbnail: string | null;
  version: string;
  featured: boolean;
  displayOrder: number;
  orientation: GameOrientation;
  platforms: GamePlatform[];
  minClientVersion: string | null;
}
