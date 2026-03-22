/**
 * Route Response Contract
 *
 * Unified response helpers for quotes API routes.
 * Ensures consistent success/failure response shapes.
 *
 * ## Response Patterns
 *
 * ### Success (200)
 * - List routes: { items: T[] } where items key matches resource name
 * - Single resource: T (the resource object directly)
 *
 * ### Client Errors
 * - 400 Bad Request: Missing/invalid parameters
 * - 404 Not Found: Resource not found (session, turn, file)
 *
 * ### Server Errors
 * - 500 Internal Server Error: Unexpected errors
 *
 * ### Error Response Shape
 * All errors return: { error: string }
 */

/**
 * API success response with typed data
 */
export function successResponse<T>(
  data: T,
  headers: Record<string, string>,
  status = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}

/**
 * API error response
 * Always returns { error: string } shape
 */
export function failureResponse(
  error: string,
  headers: Record<string, string>,
  status: 400 | 404 | 500 = 400
): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}

/**
 * Handle common error cases and convert to appropriate response
 */
export function handleError(
  error: unknown,
  headers: Record<string, string>
): Response {
  const message = error instanceof Error ? error.message : String(error);
  return failureResponse(message, headers, 500);
}

/**
 * Session resolution result type
 */
export type SessionResult =
  | { ok: true; cwd: string }
  | { ok: false; error: string; status: 400 | 404 };
