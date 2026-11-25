import { JsonObject } from '../../interfaces/game-engine.interface';
import { EngineRuleError } from './engine-rule-error';

/** Rounds to 2 decimal places (demo credits keep at most cents, like the existing games). */
export const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Rounds DOWN to 2 decimal places. */
export const floor2 = (value: number): number => Math.floor(value * 100 + 1e-9) / 100;

export function asObject(value: unknown, what = 'bet'): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new EngineRuleError(`The ${what} must be a JSON object.`);
  }
  return value as JsonObject;
}

/** An integer within [min, max]. */
export function asInteger(value: unknown, name: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new EngineRuleError(`${name} must be a whole number from ${min} to ${max}.`);
  }
  return value;
}

/** One of the allowed values (e.g. a bet step). */
export function asOneOf(value: unknown, name: string, allowed: readonly number[]): number {
  if (typeof value !== 'number' || !allowed.includes(value)) {
    throw new EngineRuleError(`${name} must be one of: ${allowed.join(', ')}.`);
  }
  return value;
}

/** Reads a number carried in an engine's own (trusted) state, falling back to `fallback`. */
export function readNumber(state: JsonObject, key: string, fallback = 0): number {
  const value = state[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
