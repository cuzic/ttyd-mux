/**
 * Recent Route
 *
 * GET /api/claude-quotes/recent - Get recent Claude turns
 * GET /api/claude-quotes/recent-markdown - Get recent markdown files
 */

import {
  collectRecentMarkdown,
  getRecentClaudeTurns,
  getRecentClaudeTurnsFromSession
} from '../quotes-service.js';
import { RecentMarkdownParamsSchema, RecentParamsSchema, parseSearchParams } from './params.js';
import { failureResponse, handleError, successResponse } from './response.js';
import {
  type QuoteRouteContext,
  resolveClaudeFromParams,
  resolveWorkspaceFromParams
} from './types.js';

/**
 * Handle /recent-markdown route
 */
export function handleRecentMarkdownRoute(ctx: QuoteRouteContext): Response {
  const parsed = parseSearchParams(ctx.params, RecentMarkdownParamsSchema);
  if (!parsed.ok) return failureResponse(parsed.error, ctx.headers, 400);

  const cwd = resolveWorkspaceFromParams(ctx);
  if (cwd instanceof Response) return cwd;

  try {
    const files = collectRecentMarkdown(cwd, parsed.value.hours, parsed.value.count);
    return successResponse({ files }, ctx.headers);
  } catch (error) {
    return handleError(error, ctx.headers);
  }
}

/**
 * Handle /recent route (Claude turns)
 */
export async function handleRecentRoute(ctx: QuoteRouteContext): Promise<Response> {
  const parsed = parseSearchParams(ctx.params, RecentParamsSchema);
  if (!parsed.ok) return failureResponse(parsed.error, ctx.headers, 400);

  const claude = resolveClaudeFromParams(ctx);
  if (claude instanceof Response) return claude;

  try {
    const turns = claude.claudeSessionId
      ? await getRecentClaudeTurnsFromSession(claude.cwd, claude.claudeSessionId, parsed.value.count)
      : await getRecentClaudeTurns(claude.cwd, parsed.value.count);
    return successResponse({ turns }, ctx.headers);
  } catch (error) {
    return handleError(error, ctx.headers);
  }
}
