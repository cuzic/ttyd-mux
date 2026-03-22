/**
 * File Content Route
 *
 * GET /api/claude-quotes/file-content - Get file content
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import { type QuoteRouteContext, successResponse, failureResponse } from './types.js';
import { readFileContent } from '../quotes-service.js';

/**
 * Handle /file-content route
 *
 * Success: { content: string, ... }
 * Error: { error: string } with appropriate status code
 */
export function handleFileContentRoute(ctx: QuoteRouteContext): Response {
  const source = ctx.params.get('source');
  const filePath = ctx.params.get('path');
  const sessionName = ctx.params.get('session');
  const isPreview = ctx.params.get('preview') === 'true';

  if (!source || !filePath) {
    return failureResponse('source and path parameters required', ctx.headers, 400);
  }

  let baseDir: string;
  if (source === 'plans') {
    baseDir = join(homedir(), '.claude', 'plans');
  } else if (source === 'project') {
    if (!sessionName) {
      return failureResponse('session parameter required for project source', ctx.headers, 400);
    }
    const session = ctx.sessionManager.getSession(sessionName);
    if (!session) {
      return failureResponse('Session not found', ctx.headers, 404);
    }
    baseDir = session.cwd;
  } else {
    return failureResponse('source must be "project" or "plans"', ctx.headers, 400);
  }

  const result = readFileContent(baseDir, filePath, isPreview);
  if ('error' in result) {
    return failureResponse(result.error, ctx.headers, result.error === 'File not found' ? 404 : 400);
  }

  return successResponse(result, ctx.headers);
}
