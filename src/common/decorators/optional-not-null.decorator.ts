import { ValidateIf } from 'class-validator';

/**
 * For PATCH-style DTOs: the property may be omitted, but if present it must be valid.
 * Unlike `@IsOptional()`, an explicit `null` is NOT skipped, so it fails validation
 * instead of reaching the database. Use `@IsOptional()` only for nullable columns.
 */
export const OptionalNotNull = (): PropertyDecorator =>
  ValidateIf((_object: unknown, value: unknown) => value !== undefined);
