/**
 * File Content Route
 *
 * GET /api/claude-quotes/file-content - Get file content
 */

import { readFileContent, resolveFileContentBaseDir } from '../quotes-service.js';
import { FileContentParamsSchema, parseSearchParams } from './params.js';
import { failureResponse, successResponse } from './response.js';
import { type QuoteRouteContext, resolveWorkspaceFromParams } from './types.js';

/**
 * Handle /file-content route
 *
 * source='project': uses workspace from session/locator
 * source='plans': uses ~/.claude/plans (no workspace needed)
 */
export function handleFileContentRoute(ctx: QuoteRouteContext): Response {
  const parsed = parseSearchParams(ctx.params, FileContentParamsSchema);
  if (!parsed.ok) return failureResponse(parsed.error, ctx.headers, 400);

  const { source, path: filePath, preview: isPreview } = parsed.value;

  // Resolve workspace for project source only
  let workspaceCwd: string | undefined;
  if (source === 'project') {
    const cwd = resolveWorkspaceFromParams(ctx);
    if (cwd instanceof Response) return cwd;
    workspaceCwd = cwd;
  }

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
