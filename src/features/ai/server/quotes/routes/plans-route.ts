/**
 * Plans Route
 *
 * GET /api/claude-quotes/plans - Get plan files from ~/.claude/plans
 */

import { type QuoteRouteContext, jsonResponse, errorResponse } from './types.js';
import { getPlanFiles } from '../quotes-service.js';

/**
 * Handle /plans route
 */
export function handlePlansRoute(ctx: QuoteRouteContext): Response {
  const count = Math.min(Number.parseInt(ctx.params.get('count') ?? '10', 10), 50);

  try {
    const files = getPlanFiles(count);
    return jsonResponse({ files }, ctx.headers);
  } catch (error) {
    return errorResponse(String(error), ctx.headers, 500);
  }
}
