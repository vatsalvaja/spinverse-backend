export const ADMIN_PACKAGES_ROUTE = 'admin/games';
export const ADMIN_PACKAGES_API_TAG = 'Admin - Game Packages';
export const LAUNCH_API_TAG = 'Game Launch';

export const RELEASE_NOTES_MAX_LENGTH = 1000;
export const ZIP_MIME_HINT = '.zip';

export const PACKAGE_ERRORS = {
  NO_FILE: 'A ZIP file is required in the "file" field',
  NOT_A_ZIP_NAME: 'The uploaded file must have a .zip extension',
  TOO_LARGE: 'The uploaded package is larger than the allowed maximum',
  INVALID_PACKAGE: 'The package did not pass validation',
  VERSION_NOT_FOUND: 'Package version not found',
  VERSION_EXISTS: 'This version has already been uploaded. Versions are permanent: bump the version number',
  ALREADY_INSTALLED_USE_ROLLBACK:
    'This version is already installed. To switch back to it, use rollback',
  NOTHING_INSTALLED: 'Install a package version before publishing',
  NOT_ROLLBACK_TARGET: 'Only a previously installed version can be rolled back to',
  NOT_INSTALLED: 'Only an installed version can be uninstalled',
  UNPUBLISH_FIRST: 'This version is published. Unpublish the game before uninstalling it',
  ALREADY_CURRENT: 'This version is already the installed version',
  FILES_MISSING: 'The installed files for this version are missing on the server',
  INTEGRITY_FAILED: 'The stored package no longer matches its checksum',
  INSTALL_FAILED: 'The package could not be installed',
  GAME_UNAVAILABLE: 'This game is not available',
  LAUNCH_EXPIRED: 'This launch link is no longer valid. Please launch the game again',
} as const;

export const PACKAGE_MESSAGES = {
  UPLOADED: 'Package uploaded and validated successfully',
  LISTED: 'Package versions fetched successfully',
  FETCHED: 'Package version fetched successfully',
  INSTALLED: 'Package installed successfully',
  UNINSTALLED: 'Package uninstalled successfully',
  AVAILABILITY: 'Game availability fetched successfully',
  PUBLISHED: 'Game published successfully',
  UNPUBLISHED: 'Game unpublished successfully',
  ROLLED_BACK: 'Rolled back successfully',
  EVENTS: 'Package history fetched successfully',
  LAUNCHED: 'Game launch link created',
} as const;

/** Headers for every file served to a player. Nothing is cached so revocation is immediate. */
export const PLAY_RESPONSE_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};
