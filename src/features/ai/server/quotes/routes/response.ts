/**
 * Route Response Helpers
 *
 * Simple response helpers for quotes API routes.
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
 * - 500 Internal Server Error: Unexpected errors (generic message, details logged)
 *
 * ### Error Response Shape
 * All errors return: { error: string }
 */

// === Response Helpers ===

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
 *
 * ## Error Handling Policy
 * - Known file errors (ENOENT, EACCES): Return appropriate status with safe message
 * - Unknown errors: Log internally, return generic 500 message
 *
 * This prevents exposing internal implementation details while still
 * providing useful errors for known error conditions.
 */
export function handleError(error: unknown, headers: Record<string, string>): Response {
  // Handle common Node.js file system errors
  if (isNodeError(error)) {
    switch (error.code) {
      case 'ENOENT':
        return failureResponse('Resource not found', headers, 404);
      case 'EACCES':
      case 'EPERM':
        return failureResponse('Access denied', headers, 400);
    }
  }

  // Log unexpected errors for debugging (don't expose to client)
  const internalMessage = error instanceof Error ? error.message : String(error);
  console.error('[quotes-api] Unexpected error:', internalMessage);

  // Return generic message for unknown errors
  return failureResponse('Internal server error', headers, 500);
}

/**
 * Type guard for Node.js system errors
 */
function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
