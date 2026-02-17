/**
 * Application-specific error class with structured error information
 */
export class AppError extends Error {
  public readonly code?: string;

  constructor(message: string, code?: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'AppError';
    this.code = code;
  }

  static wrap(error: unknown, message: string, code?: string): AppError {
    return new AppError(message, code, error);
  }
}

/**
 * Extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}

/**
 * Format error for CLI output
 */
export function formatCliError(prefix: string, error: unknown): string {
  return `${prefix}: ${getErrorMessage(error)}`;
}

/**
 * Handle CLI command errors consistently
 */
export function handleCliError(prefix: string, error: unknown): void {
  // biome-ignore lint/suspicious/noConsole: CLI error output is intentional
  console.error(formatCliError(prefix, error));
}

/**
 * Wrap a function with error handling
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  errorPrefix: string
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    handleCliError(errorPrefix, error);
    return null;
  }
}

/**
 * Assert that hostname is provided, exit if not
 */
export function requireHostname(hostname: string | undefined): asserts hostname is string {
  if (!hostname) {
    console.error('Error: --hostname is required (or set hostname in config.yaml)');
    process.exit(1);
  }
}
