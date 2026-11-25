export const ADMIN_GAMES_ROUTE = 'admin/games';
export const GAMES_ROUTE = 'games';
export const ADMIN_GAMES_API_TAG = 'Admin - Games';
export const GAMES_API_TAG = 'Game Catalog';

/** Mirrors the package contract used by the game package builder. */
export const GAME_ID_MIN_LENGTH = 3;
export const GAME_ID_MAX_LENGTH = 40;
export const GAME_NAME_MIN_LENGTH = 2;
export const GAME_NAME_MAX_LENGTH = 100;
export const GAME_DESCRIPTION_MAX_LENGTH = 500;
export const GAME_DEVELOPER_MAX_LENGTH = 100;
export const GAME_THUMBNAIL_MAX_LENGTH = 500;
export const GAME_DISPLAY_ORDER_MAX = 10000;
export const GAME_DEFAULT_VERSION = '1.0.0';

/** Upper bound for the free-form `settings` JSON, in bytes. */
export const GAME_SETTINGS_MAX_BYTES = 16 * 1024;

/** A relative path, asset key or http(s) URL; script-like schemes are refused. */
export const THUMBNAIL_PATTERN = /^(?!(?:javascript|data|vbscript):)\S+$/i;

export const GAME_ERRORS = {
  NOT_FOUND: 'Game not found',
  GAME_ID_TAKEN: 'A game with this game ID already exists',
  CATEGORY_INACTIVE: 'Cannot enable a game whose category is inactive',
  SETTINGS_TOO_LARGE: `settings must not exceed ${GAME_SETTINGS_MAX_BYTES} bytes`,
} as const;

export const GAME_MESSAGES = {
  CREATED: 'Game created successfully',
  LISTED: 'Games fetched successfully',
  FETCHED: 'Game fetched successfully',
  UPDATED: 'Game updated successfully',
  ENABLED: 'Game enabled successfully',
  DISABLED: 'Game disabled successfully',
  CONFIG_FETCHED: 'Game configuration fetched successfully',
  CONFIG_UPDATED: 'Game configuration updated successfully',
} as const;
