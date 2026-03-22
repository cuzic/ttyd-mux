/**
 * Plans Route
 *
 * GET /api/claude-quotes/plans - Get plan files from ~/.claude/plans
 */

import { type QuoteRouteContext, successResponse, handleError } from './types.js';
import { getPlanFiles } from '../quotes-service.js';

/**
 * Handle /plans route
 *
 * Success: { files: PlanFile[] }
 * Error: { error: string } with 500 status
 */
export function handlePlansRoute(ctx: QuoteRouteContext): Response {
  const count = Math.min(Number.parseInt(ctx.params.get('count') ?? '10', 10), 50);

  try {
    const files = getPlanFiles(count);
    return successResponse({ files }, ctx.headers);
  } catch (error) {
    return handleError(error, ctx.headers);
  }
}
