/** Thrown by a repository when another request changed the same session or round first (optimistic lock). */
export class ConcurrentUpdateError extends Error {
  constructor() {
    super('The record was changed by another request');
    this.name = 'ConcurrentUpdateError';
  }
}
