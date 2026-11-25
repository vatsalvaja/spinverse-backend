import { TransformFnParams } from 'class-transformer';

/** `@Transform` helper: trims strings, leaves other types for the validators to reject. */
export const trimString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** `@Transform` helper: trims and lower-cases an e-mail address. */
export const normalizeEmail = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** `@Transform` helper: trims and lower-cases a slug / identifier. */
export const normalizeSlug = normalizeEmail;

/** `@Transform` helper for query strings: `"true"` / `"false"` become booleans. */
export const toBoolean = ({ value }: TransformFnParams): unknown => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
};
