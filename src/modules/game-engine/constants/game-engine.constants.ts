/** Injection token for the list of available game engines. */
export const GAME_ENGINES = Symbol('GAME_ENGINES');

export const SESSIONS_ROUTE = 'game-sessions';
export const ENGINES_ROUTE = 'game-engines';
export const ADMIN_ROUNDS_ROUTE = 'admin/game-rounds';
export const SESSIONS_API_TAG = 'Game Play';
export const ENGINES_API_TAG = 'Game Play';
export const ADMIN_ROUNDS_API_TAG = 'Admin - Game Rounds';

/** A session with no open round that has been idle this long is expired the next time it is used. */
export const SESSION_IDLE_MS = 60 * 60 * 1000;

export const ENGINE_ERRORS = {
  NO_ENGINE: 'No game engine is available for this game',
  SESSION_NOT_FOUND: 'Game session not found',
  SESSION_NOT_ACTIVE: 'This game session has ended. Start a new session',
  SESSION_EXPIRED: 'This game session expired after a period of inactivity. Start a new session',
  ROUND_NOT_FOUND: 'Round not found',
  ROUND_IN_PROGRESS: 'Finish the current round first (cash out or wait for it to end)',
  INSUFFICIENT_CREDITS: 'Not enough demo credits for that bet',
  CONCURRENT_UPDATE: 'Another request changed this session at the same time. Please try again',
  ACTIONS_NOT_SUPPORTED: 'This game has no actions during a round',
  ROUND_NOT_OPEN: 'This round is already settled',
  AUDIT_NOT_READY: 'Audit details are available once the round is settled',
} as const;

export const ENGINE_MESSAGES = {
  SESSION_OPENED: 'Game session ready',
  SESSION_FETCHED: 'Game session fetched successfully',
  SESSION_CLOSED: 'Game session closed',
  ROUND_PLAYED: 'Round played',
  ROUND_FETCHED: 'Round fetched successfully',
  ROUNDS_LISTED: 'Rounds fetched successfully',
  ACTION_APPLIED: 'Action applied',
  AUDIT_FETCHED: 'Round audit fetched successfully',
  ENGINES_LISTED: 'Game engines fetched successfully',
} as const;

export const AUDIT_HOW_TO_VERIFY =
  'To check fairness: (1) sha256(hex-decode(seed)) must equal seedCommitment, which was shown when the round started; ' +
  '(2) the random stream is HMAC-SHA256(seed, counter) in 8-byte big-endian counter mode, read 32 bits at a time ' +
  '(see docs/game-algorithms/README.md); (3) feeding the same seed, bet and session state to the engine version ' +
  'named here reproduces the same result.';
