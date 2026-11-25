export const GAME_HISTORY_ROUTE = 'game-history';
export const ADMIN_GAME_HISTORY_ROUTE = 'admin/game-history';
export const GAME_HISTORY_API_TAG = 'Game History';
export const ADMIN_GAME_HISTORY_API_TAG = 'Admin - Game History';

export const HISTORY_ERRORS = {
  ROUND_NOT_FOUND: 'Game round not found',
  GAME_NOT_FOUND: 'Game not found',
  INVALID_RANGE: '"from" must not be after "to"',
} as const;

export const HISTORY_MESSAGES = {
  LISTED: 'Game history fetched successfully',
  DETAIL: 'Game round fetched successfully',
  STATS: 'Game statistics fetched successfully',
} as const;

/** Upper bound for "top N" style reports. */
export const REPORT_MAX_LIMIT = 100;
export const REPORT_DEFAULT_LIMIT = 20;
