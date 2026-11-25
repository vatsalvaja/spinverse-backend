/** True when at least one property of `value` is not `undefined` (used by PATCH endpoints). */
export function hasDefinedValues(value: object): boolean {
  return Object.values(value).some((entry) => entry !== undefined);
}
