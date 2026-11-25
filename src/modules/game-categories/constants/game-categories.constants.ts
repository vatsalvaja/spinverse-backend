export const ADMIN_GAME_CATEGORIES_ROUTE = 'admin/game-categories';
export const GAME_CATEGORIES_ROUTE = 'game-categories';
export const ADMIN_GAME_CATEGORIES_API_TAG = 'Admin - Game Categories';
export const GAME_CATEGORIES_API_TAG = 'Game Catalog';

export const CATEGORY_NAME_MIN_LENGTH = 2;
export const CATEGORY_NAME_MAX_LENGTH = 50;
export const CATEGORY_SLUG_MIN_LENGTH = 2;
export const CATEGORY_SLUG_MAX_LENGTH = 50;
export const CATEGORY_DESCRIPTION_MAX_LENGTH = 300;
export const CATEGORY_SORT_ORDER_MAX = 10000;

export const CATEGORY_ERRORS = {
  NOT_FOUND: 'Game category not found',
  INACTIVE: 'Game category is inactive',
  NAME_TAKEN: 'A game category with this name already exists',
  SLUG_TAKEN: 'A game category with this slug already exists',
  CANNOT_DERIVE_SLUG: 'A slug could not be derived from the name; please provide one',
} as const;

export const CATEGORY_MESSAGES = {
  CREATED: 'Game category created successfully',
  LISTED: 'Game categories fetched successfully',
  FETCHED: 'Game category fetched successfully',
  UPDATED: 'Game category updated successfully',
  ACTIVATED: 'Game category activated successfully',
  DEACTIVATED: 'Game category deactivated successfully',
} as const;
