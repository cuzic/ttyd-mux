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
  parseLocator,
  resolveClaudeContext,
  resolveWorkspace
} from './types.js';

/**
 * Handle /recent-markdown route
 *
 * Workspace-only route (file system access).
 * Accepts either bunterm session or Claude locator.
 *
 * Success: { files: MdFileInfo[] }
 * Error: { error: string } with appropriate status code
 */
export function handleRecentMarkdownRoute(ctx: QuoteRouteContext): Response {
  // Parse parameters
  const parsed = parseSearchParams(ctx.params, RecentMarkdownParamsSchema);
  if (!parsed.ok) {
    return failureResponse(parsed.error, ctx.headers, 400);
  }
  const { count, hours } = parsed.value;

  // Resolve workspace
  const locator = parseLocator(ctx.params);
  if (!locator.ok) {
    return failureResponse(locator.error.error, ctx.headers, locator.error.status);
  }
  const workspace = resolveWorkspace(locator.value, ctx.sessionManager);
  if (!workspace.ok) {
    return failureResponse(workspace.error.error, ctx.headers, workspace.error.status);
  }

  // Collect recent markdown files
  try {
    const files = collectRecentMarkdown(workspace.value.cwd, hours, count);
    return successResponse({ files }, ctx.headers);
  } catch (error) {
    return handleError(error, ctx.headers);
  }
}

/**
 * Handle /recent route (Claude turns)
 *
 * Accepts either bunterm session or Claude (claudeSessionId + projectPath).
 * Uses different query methods based on context availability.
 *
 * Success: { turns: ClaudeTurn[] }
 * Error: { error: string } with appropriate status code
 */
export async function handleRecentRoute(ctx: QuoteRouteContext): Promise<Response> {
  // Parse parameters
  const parsed = parseSearchParams(ctx.params, RecentParamsSchema);
  if (!parsed.ok) {
    return failureResponse(parsed.error, ctx.headers, 400);
  }
  const { count } = parsed.value;

  // Resolve Claude context
  const locator = parseLocator(ctx.params);
  if (!locator.ok) {
    return failureResponse(locator.error.error, ctx.headers, locator.error.status);
  }
  const claude = resolveClaudeContext(locator.value, ctx.sessionManager);
  if (!claude.ok) {
    return failureResponse(claude.error.error, ctx.headers, claude.error.status);
  }

  // Get Claude turns - explicit branching based on claudeSessionId
  try {
    const turns = claude.value.claudeSessionId
      ? await getRecentClaudeTurnsFromSession(claude.value.cwd, claude.value.claudeSessionId, count)
      : await getRecentClaudeTurns(claude.value.cwd, count);
    return successResponse({ turns }, ctx.headers);
  } catch (error) {
    return handleError(error, ctx.headers);
  }
}
