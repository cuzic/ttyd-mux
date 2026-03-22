/**
 * Recent Route
 *
 * GET /api/claude-quotes/recent - Get recent Claude turns
 * GET /api/claude-quotes/recent-markdown - Get recent markdown files
 */

import {
  type QuoteRouteContext,
  successResponse,
  failureResponse,
  handleError,
  resolveSession
} from './types.js';
import {
  collectMdFiles,
  getRecentClaudeTurns,
  getRecentClaudeTurnsFromSession
} from '../quotes-service.js';

/**
 * Handle /recent-markdown route
 *
 * Success: { files: MdFileInfo[] }
 * Error: { error: string } with appropriate status code
 */
export async function handleRecentMarkdownRoute(ctx: QuoteRouteContext): Promise<Response> {
  const count = Math.min(Number.parseInt(ctx.params.get('count') ?? '20', 10), 50);
  const hours = Math.min(Number.parseInt(ctx.params.get('hours') ?? '24', 10), 168);

  const sessionResult = resolveSession(ctx);
  if (!sessionResult.ok) {
    return failureResponse(sessionResult.error, ctx.headers, sessionResult.status);
  }

  try {
    const cutoffTime = Date.now() - hours * 60 * 60 * 1000;
    const allFiles = collectMdFiles(sessionResult.cwd, sessionResult.cwd, {
      excludeDirs: ['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '__pycache__'],
      maxDepth: 10
    });
    const files = allFiles
      .filter((f) => new Date(f.modifiedAt).getTime() > cutoffTime)
      .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
      .slice(0, count);
    return successResponse({ files }, ctx.headers);
  } catch (error) {
    return handleError(error, ctx.headers);
  }
}

/**
 * Handle /recent route (Claude turns)
 *
 * Success: { turns: ClaudeTurn[] }
 * Error: { error: string } with appropriate status code
 */
export async function handleRecentRoute(ctx: QuoteRouteContext): Promise<Response> {
  const claudeSessionId = ctx.params.get('claudeSessionId');
  const projectPath = ctx.params.get('projectPath');
  const count = Math.min(Number.parseInt(ctx.params.get('count') ?? '20', 10), 50);

  // Use claudeSessionId + projectPath if provided (new approach)
  if (claudeSessionId && projectPath) {
    try {
      const turns = await getRecentClaudeTurnsFromSession(projectPath, claudeSessionId, count);
      return successResponse({ turns }, ctx.headers);
    } catch (error) {
      return handleError(error, ctx.headers);
    }
  }

  // Fallback: legacy approach using bunterm session name
  const sessionResult = resolveSession(ctx);
  if (!sessionResult.ok) {
    return failureResponse(
      sessionResult.status === 400
        ? 'Either (claudeSessionId + projectPath) or session parameter is required'
        : sessionResult.error,
      ctx.headers,
      sessionResult.status
    );
  }

  try {
    const turns = await getRecentClaudeTurns(sessionResult.cwd, count);
    return successResponse({ turns }, ctx.headers);
  } catch (error) {
    return handleError(error, ctx.headers);
  }
}
