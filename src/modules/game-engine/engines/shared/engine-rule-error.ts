/**
 * Thrown by an engine when a bet or action breaks the game's rules.
 * `invalid` = the request itself is wrong (maps to 400); `conflict` = right request, wrong moment (maps to 409).
 */
export class EngineRuleError extends Error {
  constructor(
    message: string,
    readonly kind: 'invalid' | 'conflict' = 'invalid',
  ) {
    super(message);
    this.name = 'EngineRuleError';
  }
}
