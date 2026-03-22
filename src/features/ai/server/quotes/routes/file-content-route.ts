/**
 * File Content Route
 *
 * GET /api/claude-quotes/file-content - Get file content
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import { type QuoteRouteContext, jsonResponse, errorResponse } from './types.js';
import { readFileContent } from '../quotes-service.js';

/**
 * Handle /file-content route
 */
export function handleFileContentRoute(ctx: QuoteRouteContext): Response {
  const source = ctx.params.get('source');
  const filePath = ctx.params.get('path');
  const sessionName = ctx.params.get('session');
  const isPreview = ctx.params.get('preview') === 'true';

  if (!source || !filePath) {
    return errorResponse('source and path parameters required', ctx.headers);
  }

  let baseDir: string;
  if (source === 'plans') {
    baseDir = join(homedir(), '.claude', 'plans');
  } else if (source === 'project') {
    if (!sessionName) {
      return errorResponse('session parameter required for project source', ctx.headers);
    }
    const session = ctx.sessionManager.getSession(sessionName);
    if (!session) {
      return errorResponse('Session not found', ctx.headers, 404);
    }
    baseDir = session.cwd;
  } else {
    return errorResponse('source must be "project" or "plans"', ctx.headers);
  }

  const result = readFileContent(baseDir, filePath, isPreview);
  if ('error' in result) {
    return errorResponse(result.error, ctx.headers, result.error === 'File not found' ? 404 : 400);
  }

  return jsonResponse(result, ctx.headers);
}
