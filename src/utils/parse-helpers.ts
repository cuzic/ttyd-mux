/**
 * Parse Helpers
 *
 * Common utilities for parsing external inputs at system boundaries.
 * Converts raw external data to validated domain types using Zod schemas.
 *
 * @example
 * ```typescript
 * const schema = z.object({ limit: z.coerce.number().min(1).max(100) });
 * const result = parseQuery(schema, 'query', new URLSearchParams('limit=50'));
 * if (result.ok) {
 *   const { limit } = result.value; // number
 * }
 * ```
 */

import type { ZodError, ZodSchema } from 'zod';
import { type ParseError, type ParseErrorSource, parseError } from '@/core/errors.js';
import { err, ok, type Result } from './result.js';

/**
 * Zod issue type (simplified for compatibility with Zod v4)
 */
interface ZodIssueBase {
  code: string;
  path: (string | number)[];
  message: string;
  // Optional fields that may exist depending on issue type
  expected?: string;
  received?: string;
  options?: string[];
  values?: string[];
  type?: string;
}

/**
 * Convert a Zod error to ParseError
 */
export function zodErrorToParseError(zodError: ZodError, source: ParseErrorSource): ParseError {
  const issue = zodError.issues[0] as ZodIssueBase | undefined;
  if (!issue) {
    return parseError('PARSE_FAILED', source, '_root', 'Unknown validation error');
  }
  return zodIssueToParsError(issue, source);
}

/**
 * Convert a single Zod issue to ParseError
 */
function zodIssueToParsError(issue: ZodIssueBase, source: ParseErrorSource): ParseError {
  const field = issue.path.join('.') || '_root';

  switch (issue.code) {
    case 'invalid_type':
      return parseError('INVALID_TYPE', source, field, issue.message, {
        expected: issue.expected,
        received: issue.received
      });

    case 'invalid_enum_value':
      return parseError('INVALID_ENUM', source, field, issue.message, {
        expected: issue.options?.join(', '),
        received: issue.received
      });

    case 'invalid_value':
      // Zod v4 uses 'invalid_value' for enum validation
      return parseError('INVALID_ENUM', source, field, issue.message, {
        expected: issue.values?.join(', ')
      });

    case 'too_small':
      return parseError(
        issue.type === 'string' ? 'TOO_SHORT' : 'OUT_OF_RANGE',
        source,
        field,
        issue.message
      );

    case 'too_big':
      return parseError(
        issue.type === 'string' ? 'TOO_LONG' : 'OUT_OF_RANGE',
        source,
        field,
        issue.message
      );

    case 'invalid_string':
    case 'invalid_format':
      return parseError('INVALID_FORMAT', source, field, issue.message);

    default:
      return parseError('PARSE_FAILED', source, field, issue.message);
  }
}

/**
 * Parse query parameters using a Zod schema
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   limit: z.coerce.number().min(1).max(100).default(20),
 *   status: z.enum(['active', 'inactive']).optional()
 * });
 * const result = parseQuery(schema, 'query', request.url);
 * ```
 */
export function parseQuery<T>(
  schema: ZodSchema<T>,
  source: ParseErrorSource,
  input: URLSearchParams | string | URL
): Result<T, ParseError> {
  const params =
    input instanceof URLSearchParams
      ? input
      : input instanceof URL
        ? input.searchParams
        : new URLSearchParams(input.includes('?') ? input.split('?')[1] : input);

  // Convert URLSearchParams to object
  const obj: Record<string, string> = {};
  for (const [key, value] of params) {
    obj[key] = value;
  }

  const parsed = schema.safeParse(obj);
  if (parsed.success) {
    return ok(parsed.data);
  }
  return err(zodErrorToParseError(parsed.error, source));
}

/**
 * Parse JSON body using a Zod schema
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   name: z.string().min(1).max(100),
 *   description: z.string().optional()
 * });
 * const result = await parseJsonBody(schema, request);
 * ```
 */
export async function parseJsonBody<T>(
  schema: ZodSchema<T>,
  request: Request
): Promise<Result<T, ParseError>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return err(parseError('PARSE_FAILED', 'body', '_root', 'Invalid JSON body'));
  }

  const parsed = schema.safeParse(raw);
  if (parsed.success) {
    return ok(parsed.data);
  }
  return err(zodErrorToParseError(parsed.error, 'body'));
}

/**
 * Parse path parameters using a Zod schema
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   id: z.string().uuid(),
 *   version: z.coerce.number().int().min(1)
 * });
 * const result = parsePathParams(schema, { id: 'abc-123', version: '2' });
 * ```
 */
export function parsePathParams<T>(
  schema: ZodSchema<T>,
  params: Record<string, string | undefined>
): Result<T, ParseError> {
  const parsed = schema.safeParse(params);
  if (parsed.success) {
    return ok(parsed.data);
  }
  return err(zodErrorToParseError(parsed.error, 'path'));
}

/**
 * Parse JSON string using a Zod schema
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   sessions: z.array(z.object({ name: z.string() }))
 * });
 * const result = parseJsonString(schema, 'json', jsonText);
 * ```
 */
export function parseJsonString<T>(
  schema: ZodSchema<T>,
  source: ParseErrorSource,
  input: string
): Result<T, ParseError> {
  let raw: unknown;
  try {
    raw = JSON.parse(input);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Invalid JSON';
    return err(parseError('PARSE_FAILED', source, '_root', message));
  }

  const parsed = schema.safeParse(raw);
  if (parsed.success) {
    return ok(parsed.data);
  }
  return err(zodErrorToParseError(parsed.error, source));
}

/**
 * Parse environment variables using a Zod schema
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   BUNTERM_PORT: z.coerce.number().default(7600),
 *   BUNTERM_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info')
 * });
 * const result = parseEnv(schema, process.env);
 * ```
 */
export function parseEnv<T>(
  schema: ZodSchema<T>,
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): Result<T, ParseError> {
  const parsed = schema.safeParse(env);
  if (parsed.success) {
    return ok(parsed.data);
  }
  return err(zodErrorToParseError(parsed.error, 'env'));
}

/**
 * Parse unknown data using a Zod schema (for daemon responses, file content, etc.)
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   status: z.enum(['running', 'stopped']),
 *   pid: z.number()
 * });
 * const result = parseUnknown(schema, 'json', daemonResponse);
 * ```
 */
export function parseUnknown<T>(
  schema: ZodSchema<T>,
  source: ParseErrorSource,
  input: unknown
): Result<T, ParseError> {
  const parsed = schema.safeParse(input);
  if (parsed.success) {
    return ok(parsed.data);
  }
  return err(zodErrorToParseError(parsed.error, source));
}

/**
 * Type guard helper: Check if a value is a ParseError
 */
export function isParseError(value: unknown): value is ParseError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (value as ParseError).type === 'parse'
  );
}

/**
 * Convert ParseError to HTTP status code
 */
export function parseErrorToHttpStatus(error: ParseError): number {
  switch (error.code) {
    case 'MISSING_FIELD':
    case 'INVALID_TYPE':
    case 'INVALID_FORMAT':
    case 'INVALID_ENUM':
    case 'TOO_LONG':
    case 'TOO_SHORT':
    case 'OUT_OF_RANGE':
      return 400; // Bad Request

    case 'PARSE_FAILED':
      return error.source === 'body' ? 400 : 422; // Unprocessable Entity for non-body

    default:
      return 400;
  }
}

/**
 * Format ParseError for HTTP response
 */
export function formatParseErrorResponse(error: ParseError): {
  error: {
    type: 'parse';
    code: string;
    field: string;
    message: string;
  };
} {
  return {
    error: {
      type: 'parse',
      code: error.code,
      field: error.field,
      message: error.message
    }
  };
}
