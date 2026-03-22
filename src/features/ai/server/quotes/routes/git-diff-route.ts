/**
 * Git Diff Routes
 *
 * GET /api/claude-quotes/git-diff - Get repository diff
 * GET /api/claude-quotes/git-diff-file - Get single file diff
 */

import {
  type QuoteRouteContext,
  jsonResponse,
  errorResponse,
  resolveSession
} from './types.js';
import { getGitDiff, getFileDiff } from '../quotes-service.js';

/**
 * Handle /git-diff route
 */
export async function handleGitDiffRoute(ctx: QuoteRouteContext): Promise<Response> {
  const sessionResult = resolveSession(ctx);
  if ('error' in sessionResult) {
    return errorResponse(sessionResult.error, ctx.headers, sessionResult.status);
  }

  try {
    return jsonResponse(await getGitDiff(sessionResult.cwd), ctx.headers);
  } catch (error) {
    return errorResponse(String(error), ctx.headers, 500);
  }
}

/**
 * Handle /git-diff-file route
 */
export async function handleGitDiffFileRoute(ctx: QuoteRouteContext): Promise<Response> {
  const filePath = ctx.params.get('path');

  if (!filePath) {
    return errorResponse('session and path parameters required', ctx.headers);
  }

  const sessionResult = resolveSession(ctx);
  if ('error' in sessionResult) {
    return errorResponse(sessionResult.error, ctx.headers, sessionResult.status);
  }

  try {
    const diff = await getFileDiff(sessionResult.cwd, filePath);
    return jsonResponse({ path: filePath, diff }, ctx.headers);
  } catch (error) {
    return errorResponse(String(error), ctx.headers, 500);
  }
}
