/** `type` claim embedded in every JWT so an access token can never act as a refresh token. */
export enum TokenType {
  Access = 'access',
  Refresh = 'refresh',
  /** Short-lived game launch link (Phase 5). Never accepted as an access token. */
  Launch = 'launch',
}
