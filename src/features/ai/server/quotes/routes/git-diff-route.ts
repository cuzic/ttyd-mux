/**
 * Git Diff Routes
 *
 * GET /api/claude-quotes/git-diff - Get repository diff
 * GET /api/claude-quotes/git-diff-file - Get single file diff
 */

import {
  type QuoteRouteContext,
  successResponse,
  failureResponse,
  handleError,
  resolveSession
} from './types.js';
import { getGitDiff, getFileDiff } from '../quotes-service.js';

/**
 * Handle /git-diff route
 *
 * Success: GitDiff object
 * Error: { error: string } with appropriate status code
 */
export async function handleGitDiffRoute(ctx: QuoteRouteContext): Promise<Response> {
  const sessionResult = resolveSession(ctx);
  if (!sessionResult.ok) {
    return failureResponse(sessionResult.error, ctx.headers, sessionResult.status);
  }

  try {
    return successResponse(await getGitDiff(sessionResult.cwd), ctx.headers);
  } catch (error) {
    return handleError(error, ctx.headers);
  }
}

/**
 * Handle /git-diff-file route
 *
 * Success: { path: string, diff: string }
 * Error: { error: string } with appropriate status code
 */
export async function handleGitDiffFileRoute(ctx: QuoteRouteContext): Promise<Response> {
  const filePath = ctx.params.get('path');

  if (!filePath) {
    return failureResponse('session and path parameters required', ctx.headers, 400);
  }

  const sessionResult = resolveSession(ctx);
  if (!sessionResult.ok) {
    return failureResponse(sessionResult.error, ctx.headers, sessionResult.status);
  }

  try {
    const diff = await getFileDiff(sessionResult.cwd, filePath);
    return successResponse({ path: filePath, diff }, ctx.headers);
  } catch (error) {
    return handleError(error, ctx.headers);
  }
}
