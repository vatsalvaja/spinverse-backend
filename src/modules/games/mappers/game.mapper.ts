import { GameCatalogItem, GameConfig, GameWithCategory } from '../interfaces/game.interface';

export function toGameConfig(game: GameWithCategory): GameConfig {
  return {
    visibility: game.visibility,
    featured: game.featured,
    displayOrder: game.displayOrder,
    orientation: game.orientation,
    platforms: game.platforms,
    minClientVersion: game.minClientVersion,
    settings: game.settings,
  };
}

export function toCatalogItem(game: GameWithCategory): GameCatalogItem {
  return {
    gameId: game.gameId,
    name: game.name,
    description: game.description,
    developer: game.developer,
    category: { slug: game.category.slug, name: game.category.name },
    thumbnail: game.thumbnail,
    version: game.version,
    featured: game.featured,
    displayOrder: game.displayOrder,
    orientation: game.orientation,
    platforms: game.platforms,
    minClientVersion: game.minClientVersion,
  };
}
