/**
 * Sessions Route
 *
 * GET /api/claude-quotes/sessions - List recent Claude sessions
 */

import { type QuoteRouteContext, successResponse, handleError } from './types.js';
import { getRecentClaudeSessions } from '../quotes-service.js';

/**
 * Handle /sessions route
 *
 * Success: { sessions: ClaudeSession[] }
 * Error: { error: string } with 500 status
 */
export function handleSessionsRoute(ctx: QuoteRouteContext): Response {
  const limit = Math.min(Number.parseInt(ctx.params.get('limit') ?? '10', 10), 20);
  try {
    return successResponse({ sessions: getRecentClaudeSessions(limit) }, ctx.headers);
  } catch (error) {
    return handleError(error, ctx.headers);
  }
}
