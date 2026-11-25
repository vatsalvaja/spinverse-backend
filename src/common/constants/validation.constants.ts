/** Lower-case words separated by single hyphens, e.g. `pharaohs-fortune`. */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** `MAJOR.MINOR.PATCH`, e.g. `1.0.0`. */
export const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const SEARCH_MAX_LENGTH = 100;
export const NO_FIELDS_TO_UPDATE = 'At least one field must be provided';
