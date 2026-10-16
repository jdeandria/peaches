/**
 * Thrown when a user action cannot be completed; the message is written for
 * people and shown as-is in the UI.
 */
export class DomainError extends Error {
  override readonly name = 'DomainError';
}

/** A message fit to show the user for any thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof DomainError) return error.message;
  if (error instanceof Error && error.message) return `Something went wrong: ${error.message}`;
  return 'Something went wrong.';
}
