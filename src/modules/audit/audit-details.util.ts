import { MAX_DETAILS_BYTES, SENSITIVE_KEY_PATTERN } from './constants/audit.constants';

/** Copies a value with every sensitive key (password, token, secret, ...) removed, at any depth. */
export function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[too deep]';
  if (Array.isArray(value)) return value.slice(0, 50).map((entry) => sanitize(entry, depth + 1));
  if (value !== null && typeof value === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (!SENSITIVE_KEY_PATTERN.test(key)) clean[key] = sanitize(entry, depth + 1);
    }
    return clean;
  }
  return typeof value === 'string' && value.length > 500 ? `${value.slice(0, 500)}...` : value;
}

/** Keeps the stored details small: an oversized body is replaced by a marker, the rest is kept. */
export function capDetails(details: Record<string, unknown>): Record<string, unknown> {
  if (JSON.stringify(details).length <= MAX_DETAILS_BYTES) return details;
  const { body: _body, ...rest } = details;
  const reduced = { ...rest, body: '[omitted: too large]' };
  return JSON.stringify(reduced).length <= MAX_DETAILS_BYTES ? reduced : { truncated: true, params: details.params };
}
