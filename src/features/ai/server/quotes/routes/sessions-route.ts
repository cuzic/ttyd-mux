/**
 * Sessions Route
 *
 * GET /api/claude-quotes/sessions - List recent Claude sessions
 */

import { getRecentClaudeSessions } from '../quotes-service.js';
import { SessionsParamsSchema, parseSearchParams } from './params.js';
import { failureResponse, handleError, successResponse } from './response.js';
import type { QuoteRouteContext } from './types.js';

/**
 * Handle /sessions route
 *
 * No session required - reads from ~/.claude/history.jsonl
 *
 * Success: { sessions: ClaudeSession[] }
 * Error: { error: string } with appropriate status code
 */
export function handleSessionsRoute(ctx: QuoteRouteContext): Response {
  // Parse parameters
  const parsed = parseSearchParams(ctx.params, SessionsParamsSchema);
  if (!parsed.ok) {
    return failureResponse(parsed.error, ctx.headers, 400);
  }

  // Get sessions
  try {
    const sessions = getRecentClaudeSessions(parsed.value.limit);
    return successResponse({ sessions }, ctx.headers);
  } catch (error) {
    return handleError(error, ctx.headers);
  }
}
