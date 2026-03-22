/**
 * File Content Route
 *
 * GET /api/claude-quotes/file-content - Get file content
 */

import { readFileContent, resolveFileContentBaseDir } from '../quotes-service.js';
import { FileContentParamsSchema, parseSearchParams } from './params.js';
import { failureResponse, successResponse } from './response.js';
import { type QuoteRouteContext, parseLocator, resolveWorkspace } from './types.js';

/**
 * Handle /file-content route
 *
 * For source='project': Accepts either bunterm session or Claude locator.
 * For source='plans': Uses ~/.claude/plans directly (no locator needed).
 *
 * Success: { content: string, truncated: boolean, totalLines: number }
 * Error: { error: string } with appropriate status code
 */
export function handleFileContentRoute(ctx: QuoteRouteContext): Response {
  const parsed = parseSearchParams(ctx.params, FileContentParamsSchema);
  if (!parsed.ok) {
    return failureResponse(parsed.error, ctx.headers, 400);
  }

  const { source, path: filePath, preview: isPreview } = parsed.value;

  // Resolve workspace for project source
  let workspaceCwd: string | undefined;
  if (source === 'project') {
    const locator = parseLocator(ctx.params);
    if (!locator.ok) {
      return failureResponse(locator.error.error, ctx.headers, locator.error.status);
    }
    const workspace = resolveWorkspace(locator.value, ctx.sessionManager);
    if (!workspace.ok) {
      return failureResponse(workspace.error.error, ctx.headers, workspace.error.status);
    }
    workspaceCwd = workspace.value.cwd;
  }

  // Resolve base directory using service function
  const baseDir = resolveFileContentBaseDir(source, workspaceCwd);

  const result = readFileContent(baseDir, filePath, isPreview);
  if ('error' in result) {
    return failureResponse(
      result.error,
      ctx.headers,
      result.error === 'File not found' ? 404 : 400
    );
  }

  return successResponse(result, ctx.headers);
}
