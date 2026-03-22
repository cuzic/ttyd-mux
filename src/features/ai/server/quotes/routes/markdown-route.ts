/**
 * Markdown Route
 *
 * GET /api/claude-quotes/project-markdown - Get project markdown files
 */

import { collectProjectMarkdown } from '../quotes-service.js';
import { ProjectMarkdownParamsSchema, parseSearchParams } from './params.js';
import { failureResponse, handleError, successResponse } from './response.js';
import { type QuoteRouteContext, resolveWorkspaceFromParams } from './types.js';

/**
 * Handle /project-markdown route
 */
export function handleMarkdownRoute(ctx: QuoteRouteContext): Response {
  const parsed = parseSearchParams(ctx.params, ProjectMarkdownParamsSchema);
  if (!parsed.ok) return failureResponse(parsed.error, ctx.headers, 400);

  const cwd = resolveWorkspaceFromParams(ctx);
  if (cwd instanceof Response) return cwd;

  try {
    const files = collectProjectMarkdown(cwd, parsed.value.count);
    return successResponse({ files }, ctx.headers);
  } catch (error) {
    return handleError(error, ctx.headers);
  }
}
