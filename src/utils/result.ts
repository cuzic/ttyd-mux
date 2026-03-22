/**
 * Result Type
 *
 * A type for representing success or failure without exceptions.
 * Use for expected errors that are part of normal business logic.
 *
 * @example
 * ```typescript
 * function divide(a: number, b: number): Result<number, 'DIV_BY_ZERO'> {
 *   if (b === 0) {
 *     return err('DIV_BY_ZERO');
 *   }
 *   return ok(a / b);
 * }
 *
 * const result = divide(10, 2);
 * if (isOk(result)) {
 *   console.log(result.value); // 5
 * }
 * ```
 */

/**
 * Successful result containing a value
 */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/**
 * Failed result containing an error
 */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/**
 * Result type - either Ok or Err
 */
export type Result<T, E> = Ok<T> | Err<E>;

/**
 * Create a successful result
 */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/**
 * Create a failed result
 */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/**
 * Type guard for Ok result
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok;
}

/**
 * Type guard for Err result
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok;
}

/**
 * Transform the value of a successful result
 *
 * @example
 * ```typescript
 * const result = ok(5);
 * const doubled = map(result, x => x * 2);
 * // doubled is ok(10)
 * ```
 */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  if (isOk(result)) {
    return ok(fn(result.value));
  }
  return result;
}

/**
 * Transform the error of a failed result
 *
 * @example
 * ```typescript
 * const result = err('NOT_FOUND');
 * const mapped = mapErr(result, e => ({ code: e }));
 * // mapped is err({ code: 'NOT_FOUND' })
 * ```
 */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  if (isErr(result)) {
    return err(fn(result.error));
  }
  return result;
}

/**
 * Chain results, returning the first error or the final success
 *
 * @example
 * ```typescript
 * const result = ok(5);
 * const chained = andThen(result, x => x > 0 ? ok(x * 2) : err('NEGATIVE'));
 * // chained is ok(10)
 * ```
 */
export function andThen<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (isOk(result)) {
    return fn(result.value);
  }
  return result;
}

/**
 * Unwrap a result, throwing if it's an error
 *
 * @throws Error if the result is an Err
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.value;
  }
  throw new Error(`Unwrap called on Err: ${String(result.error)}`);
}

/**
 * Unwrap a result with a custom error message
 *
 * @throws Error if the result is an Err
 */
export function expect<T, E>(result: Result<T, E>, message: string): T {
  if (isOk(result)) {
    return result.value;
  }
  throw new Error(`${message}: ${String(result.error)}`);
}

/**
 * Get the value or a default
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (isOk(result)) {
    return result.value;
  }
  return defaultValue;
}

/**
 * Get the value or compute a default from the error
 */
export function unwrapOrElse<T, E>(result: Result<T, E>, fn: (error: E) => T): T {
  if (isOk(result)) {
    return result.value;
  }
  return fn(result.error);
}

/**
 * Convert a throwing function to one that returns Result
 *
 * @example
 * ```typescript
 * const safeParseJson = fromThrowable(JSON.parse);
 * const result = safeParseJson('{"a": 1}');
 * ```
 */
export function fromThrowable<T, Args extends unknown[]>(
  fn: (...args: Args) => T
): (...args: Args) => Result<T, Error> {
  return (...args) => {
    try {
      return ok(fn(...args));
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  };
}

/**
 * Convert an async throwing function to one that returns Result
 */
export async function fromPromise<T>(promise: Promise<T>): Promise<Result<T, Error>> {
  try {
    return ok(await promise);
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}

/**
 * Combine multiple results into one
 * Returns the first error or an array of all values
 *
 * @example
 * ```typescript
 * const results = [ok(1), ok(2), ok(3)];
 * const combined = all(results);
 * // combined is ok([1, 2, 3])
 *
 * const withError = [ok(1), err('FAIL'), ok(3)];
 * const combinedError = all(withError);
 * // combinedError is err('FAIL')
 * ```
 */
export function all<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (isErr(result)) {
      return result;
    }
    values.push(result.value);
  }
  return ok(values);
}

// === Success with Warnings ===

/**
 * Warning that doesn't prevent success
 */
export interface Warning {
  readonly code: string;
  readonly message: string;
}

/**
 * Success result that may include warnings
 */
export interface OkWithWarnings<T> {
  readonly ok: true;
  readonly value: T;
  readonly warnings: Warning[];
}

/**
 * Result type that supports warnings on success
 */
export type ResultWithWarnings<T, E> = OkWithWarnings<T> | Err<E>;

/**
 * Create a successful result with warnings
 *
 * @example
 * ```typescript
 * // Reload succeeded but some settings need restart
 * return okWithWarnings(
 *   { reloaded: ['font_size'] },
 *   [{ code: 'REQUIRES_RESTART', message: 'daemon_port change requires restart' }]
 * );
 * ```
 */
export function okWithWarnings<T>(value: T, warnings: Warning[] = []): OkWithWarnings<T> {
  return { ok: true, value, warnings };
}

/**
 * Check if a result has warnings
 */
export function hasWarnings<T, E>(result: ResultWithWarnings<T, E>): boolean {
  return result.ok && result.warnings.length > 0;
}

/**
 * Get warnings from a successful result
 */
export function getWarnings<T, E>(result: ResultWithWarnings<T, E>): Warning[] {
  return result.ok ? result.warnings : [];
}
