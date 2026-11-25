export const ADMIN_DASHBOARD_ROUTE = 'admin/dashboard';
export const ADMIN_REPORTS_ROUTE = 'admin/reports';
export const ADMIN_DASHBOARD_API_TAG = 'Admin - Dashboard';
export const ADMIN_REPORTS_API_TAG = 'Admin - Reports';

/** How many recent items each dashboard list shows. */
export const DASHBOARD_RECENT_LIMIT = 10;
/** How many recent items the single-user overview shows. */
export const USER_OVERVIEW_RECENT_LIMIT = 5;

/** The daily report covers this many days when no range is given. */
export const DEFAULT_REPORT_DAYS = 30;
/** The longest range the daily report accepts. */
export const MAX_REPORT_DAYS = 366;

export const DASHBOARD_ERRORS = {
  RANGE_TOO_LONG: `The date range can be at most ${MAX_REPORT_DAYS} days`,
} as const;

export const DASHBOARD_MESSAGES = {
  OVERVIEW: 'Dashboard fetched successfully',
  USER_OVERVIEW: 'User overview fetched successfully',
  GAME_REPORT: 'Game report fetched successfully',
  DAILY_REPORT: 'Daily report fetched successfully',
  USER_ACTIVITY: 'User activity report fetched successfully',
} as const;
