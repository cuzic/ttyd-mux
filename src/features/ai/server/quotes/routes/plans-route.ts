/**
 * Plans Route
 *
 * GET /api/claude-quotes/plans - Get plan files from ~/.claude/plans
 */

import { getPlanFiles } from '../quotes-service.js';
import { PlansParamsSchema, parseSearchParams } from './params.js';
import { failureResponse, handleError, successResponse } from './response.js';
import type { QuoteRouteContext } from './types.js';

/**
 * Handle /plans route
 *
 * No session required - reads from fixed ~/.claude/plans directory.
 *
 * Success: { files: PlanFile[] }
 * Error: { error: string } with appropriate status code
 */
export function handlePlansRoute(ctx: QuoteRouteContext): Response {
  // Parse parameters
  const parsed = parseSearchParams(ctx.params, PlansParamsSchema);
  if (!parsed.ok) {
    return failureResponse(parsed.error, ctx.headers, 400);
  }

  // Get plan files
  try {
    const files = getPlanFiles(parsed.value.count);
    return successResponse({ files }, ctx.headers);
  } catch (error) {
    return handleError(error, ctx.headers);
  }
}
