/** Thrown when chunked assembly fails validation — must NOT trigger monolithic fallback. */
export class ScriptValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScriptValidationError';
  }
}

export function isScriptValidationError(err: unknown): boolean {
  return err instanceof ScriptValidationError;
}
