/**
 * Markdown Route
 *
 * GET /api/claude-quotes/project-markdown - Get project markdown files
 */

import {
  type QuoteRouteContext,
  successResponse,
  failureResponse,
  handleError,
  resolveSession
} from './types.js';
import { collectMdFiles } from '../quotes-service.js';

/**
 * Handle /project-markdown route
 *
 * Success: { files: MdFileInfo[] }
 * Error: { error: string } with appropriate status code
 */
export function handleMarkdownRoute(ctx: QuoteRouteContext): Response {
  const count = Math.min(Number.parseInt(ctx.params.get('count') ?? '10', 10), 50);

  const sessionResult = resolveSession(ctx);
  if (!sessionResult.ok) {
    return failureResponse(sessionResult.error, ctx.headers, sessionResult.status);
  }

  try {
    const allFiles = collectMdFiles(sessionResult.cwd, sessionResult.cwd, {
      excludeDirs: ['node_modules', '.git', 'dist', 'build', 'coverage'],
      maxDepth: 3
    });
    const files = allFiles
      .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
      .slice(0, count);
    return successResponse({ files }, ctx.headers);
  } catch (error) {
    return handleError(error, ctx.headers);
  }
}
