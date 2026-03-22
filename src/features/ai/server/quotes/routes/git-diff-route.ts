/**
 * Git Diff Routes
 *
 * GET /api/claude-quotes/git-diff - Get repository diff
 * GET /api/claude-quotes/git-diff-file - Get single file diff
 */

import { getFileDiff, getGitDiff } from '../quotes-service.js';
import { GitDiffFileParamsSchema, GitDiffParamsSchema, parseSearchParams } from './params.js';
import { failureResponse, handleError, successResponse } from './response.js';
import { type QuoteRouteContext, parseLocator, resolveWorkspace } from './types.js';

/**
 * Handle /git-diff route
 *
 * Workspace-only route (git access).
 * Accepts either bunterm session or Claude locator.
 *
 * Success: GitDiff object
 * Error: { error: string } with appropriate status code
 */
export async function handleGitDiffRoute(ctx: QuoteRouteContext): Promise<Response> {
  // Parse parameters
  const parsed = parseSearchParams(ctx.params, GitDiffParamsSchema);
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

  // Get diff
  try {
    const diff = await getGitDiff(workspace.value.cwd);
    return successResponse(diff, ctx.headers);
  } catch (error) {
    return handleError(error, ctx.headers);
  }
}

/**
 * Handle /git-diff-file route
 *
 * Workspace-only route (git access).
 * Accepts either bunterm session or Claude locator.
 *
 * Success: { path: string, diff: string }
 * Error: { error: string } with appropriate status code
 */
export async function handleGitDiffFileRoute(ctx: QuoteRouteContext): Promise<Response> {
  // Parse parameters
  const parsed = parseSearchParams(ctx.params, GitDiffFileParamsSchema);
  if (!parsed.ok) {
    return failureResponse(parsed.error, ctx.headers, 400);
  }
  const { path: filePath } = parsed.value;

  // Resolve workspace
  const locator = parseLocator(ctx.params);
  if (!locator.ok) {
    return failureResponse(locator.error.error, ctx.headers, locator.error.status);
  }
  const workspace = resolveWorkspace(locator.value, ctx.sessionManager);
  if (!workspace.ok) {
    return failureResponse(workspace.error.error, ctx.headers, workspace.error.status);
  }

  // Get file diff
  try {
    const diff = await getFileDiff(workspace.value.cwd, filePath);
    return successResponse({ path: filePath, diff }, ctx.headers);
  } catch (error) {
    return handleError(error, ctx.headers);
  }
}
