/**
 * Markdown Route
 *
 * GET /api/claude-quotes/project-markdown - Get project markdown files
 */

import { collectProjectMarkdown } from '../quotes-service.js';
import { ProjectMarkdownParamsSchema, parseSearchParams } from './params.js';
import { failureResponse, handleError, successResponse } from './response.js';
import { type QuoteRouteContext, parseLocator, resolveWorkspace } from './types.js';

/**
 * Handle /project-markdown route
 *
 * Workspace-only route (file system access).
 * Accepts either bunterm session or Claude locator.
 *
 * Success: { files: MdFileInfo[] }
 * Error: { error: string } with appropriate status code
 */
export function handleMarkdownRoute(ctx: QuoteRouteContext): Response {
  // Parse parameters
  const parsed = parseSearchParams(ctx.params, ProjectMarkdownParamsSchema);
  if (!parsed.ok) {
    return failureResponse(parsed.error, ctx.headers, 400);
  }

  // Resolve workspace
  const locator = parseLocator(ctx.params);
  if (!locator.ok) {
    return failureResponse(locator.error.error, ctx.headers, locator.error.status);
  }
  const workspace = resolveWorkspace(locator.value, ctx.sessionManager);
  if (!workspace.ok) {
    return failureResponse(workspace.error.error, ctx.headers, workspace.error.status);
  }

  // Collect markdown files
  try {
    const files = collectProjectMarkdown(workspace.value.cwd, parsed.value.count);
    return successResponse({ files }, ctx.headers);
  } catch (error) {
    return handleError(error, ctx.headers);
  }
}
