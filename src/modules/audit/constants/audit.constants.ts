export const AUDIT_ROUTE = 'admin/audit-logs';
export const AUDIT_API_TAG = 'Admin - Audit Logs';

/** Metadata key set by `@Audit()`. */
export const AUDIT_OPTIONS_KEY = 'audit_options';

/**
 * What can appear in the audit log. Plain strings in the database (no migration needed for a new action);
 * add new ones here and tag the admin route with `@Audit(...)`.
 */
export const AUDIT_ACTIONS = {
  USER_UPDATED: 'USER_UPDATED',
  USER_ACTIVATED: 'USER_ACTIVATED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  GAME_CREATED: 'GAME_CREATED',
  GAME_UPDATED: 'GAME_UPDATED',
  GAME_ENABLED: 'GAME_ENABLED',
  GAME_DISABLED: 'GAME_DISABLED',
  GAME_CONFIG_UPDATED: 'GAME_CONFIG_UPDATED',
  CATEGORY_CREATED: 'CATEGORY_CREATED',
  CATEGORY_UPDATED: 'CATEGORY_UPDATED',
  CATEGORY_ACTIVATED: 'CATEGORY_ACTIVATED',
  CATEGORY_DEACTIVATED: 'CATEGORY_DEACTIVATED',
  PACKAGE_UPLOADED: 'PACKAGE_UPLOADED',
  PACKAGE_INSTALLED: 'PACKAGE_INSTALLED',
  PACKAGE_UNINSTALLED: 'PACKAGE_UNINSTALLED',
  PACKAGE_PUBLISHED: 'PACKAGE_PUBLISHED',
  PACKAGE_UNPUBLISHED: 'PACKAGE_UNPUBLISHED',
  PACKAGE_ROLLED_BACK: 'PACKAGE_ROLLED_BACK',
  WALLET_CREDITED: 'WALLET_CREDITED',
  WALLET_DEBITED: 'WALLET_DEBITED',
  MASTER_CREATED: 'MASTER_CREATED',
  MASTER_UPDATED: 'MASTER_UPDATED',
  MASTER_ACTIVATED: 'MASTER_ACTIVATED',
  MASTER_DEACTIVATED: 'MASTER_DEACTIVATED',
  COINS_ALLOCATED_TO_MASTER: 'COINS_ALLOCATED_TO_MASTER',
  CLIENT_CREATED: 'CLIENT_CREATED',
  CLIENT_UPDATED: 'CLIENT_UPDATED',
  CLIENT_ACTIVATED: 'CLIENT_ACTIVATED',
  CLIENT_DEACTIVATED: 'CLIENT_DEACTIVATED',
  CLIENT_DELETED: 'CLIENT_DELETED',
  COINS_ALLOCATED_TO_CLIENT: 'COINS_ALLOCATED_TO_CLIENT',
} as const;

export const AUDIT_RESOURCES = {
  USER: 'USER',
  GAME: 'GAME',
  GAME_CATEGORY: 'GAME_CATEGORY',
  GAME_PACKAGE: 'GAME_PACKAGE',
  WALLET: 'WALLET',
} as const;

/** Keys that are never written to the log, wherever they appear in a request body. */
export const SENSITIVE_KEY_PATTERN = /password|secret|token|authorization|api[-_]?key|credential/i;

/** Details larger than this (serialised) are replaced by a short marker so the log stays small. */
export const MAX_DETAILS_BYTES = 4000;

export const AUDIT_MESSAGES = {
  LISTED: 'Audit log fetched successfully',
  FETCHED: 'Audit log entry fetched successfully',
} as const;

export const AUDIT_ERRORS = {
  NOT_FOUND: 'Audit log entry not found',
  INVALID_RANGE: '"from" must not be after "to"',
} as const;
