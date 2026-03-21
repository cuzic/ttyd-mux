/**
 * Claude Quotes API Handler
 *
 * Handles API routes for the Quote to Clipboard feature.
 * Routes:
 * - GET /api/claude-quotes/sessions - List recent Claude sessions
 * - GET /api/claude-quotes/recent - Get recent turns
 * - GET /api/claude-quotes/turn/:uuid - Get full turn content
 * - GET /api/claude-quotes/project-markdown - Get project *.md files
 * - GET /api/claude-quotes/plans - Get plan files
 * - GET /api/claude-quotes/file-content - Get file content
 * - GET /api/claude-quotes/git-diff - Get git diff
 * - GET /api/claude-quotes/git-diff-file - Get single file diff
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import type { NativeSessionManager } from '@/core/server/session-manager.js';
import {
  collectMdFiles,
  getClaudeTurnByUuid,
  getClaudeTurnByUuidFromSession,
  getFileDiff,
  getGitDiff,
  getPlanFiles,
  getRecentClaudeSessions,
  getRecentClaudeTurns,
  getRecentClaudeTurnsFromSession,
  readFileContent
} from './quotes-service.js';

/** JSON response helper */
const jsonResponse = (data: unknown, headers: Record<string, string>, status = 200) =>
  new Response(JSON.stringify(data), { status, headers });

/** Error response helper */
const errorResponse = (error: string, headers: Record<string, string>, status = 400) =>
  new Response(JSON.stringify({ error }), { status, headers });

/**
 * Handle Claude Quotes API request
 * @returns Response if handled, null if not a claude-quotes route
 */
export async function handleClaudeQuotesApi(
  req: Request,
  apiPath: string,
  method: string,
  headers: Record<string, string>,
  sessionManager: NativeSessionManager
): Promise<Response | null> {
  const params = new URL(req.url).searchParams;

  // GET /api/claude-quotes/sessions
  if (apiPath === '/claude-quotes/sessions' && method === 'GET') {
    const limit = Math.min(Number.parseInt(params.get('limit') ?? '10', 10), 20);
    try {
      return jsonResponse({ sessions: getRecentClaudeSessions(limit) }, headers);
    } catch (error) {
      return errorResponse(String(error), headers, 500);
    }
  }

  // GET /api/claude-quotes/recent-markdown (must be before /recent to avoid prefix match)
  if (apiPath.startsWith('/claude-quotes/recent-markdown') && method === 'GET') {
    const sessionName = params.get('session');
    const count = Math.min(Number.parseInt(params.get('count') ?? '20', 10), 50);
    const hours = Math.min(Number.parseInt(params.get('hours') ?? '24', 10), 168); // max 1 week

    if (!sessionName) {
      return errorResponse('session parameter required', headers);
    }

    const session = sessionManager.getSession(sessionName);
    if (!session) {
      return jsonResponse({ error: 'Session not found', files: [] }, headers);
    }

    try {
      const cutoffTime = Date.now() - hours * 60 * 60 * 1000;
      const allFiles = collectMdFiles(session.cwd, session.cwd, {
        excludeDirs: ['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '__pycache__'],
        maxDepth: 10 // Deeper search for recent files
      });
      const files = allFiles
        .filter((f) => new Date(f.modifiedAt).getTime() > cutoffTime)
        .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
        .slice(0, count);
      return jsonResponse({ files }, headers);
    } catch (error) {
      return errorResponse(String(error), headers, 500);
    }
  }

  // GET /api/claude-quotes/recent
  if (apiPath.startsWith('/claude-quotes/recent') && method === 'GET') {
    const claudeSessionId = params.get('claudeSessionId');
    const projectPath = params.get('projectPath');
    const count = Math.min(Number.parseInt(params.get('count') ?? '20', 10), 50);

    // Use claudeSessionId + projectPath if provided
    if (claudeSessionId && projectPath) {
      try {
        const turns = await getRecentClaudeTurnsFromSession(projectPath, claudeSessionId, count);
        return jsonResponse({ turns }, headers);
      } catch (error) {
        return errorResponse(String(error), headers, 500);
      }
    }

    // Fallback: legacy approach using bunterm session name
    const sessionName = params.get('session');
    if (!sessionName) {
      return errorResponse(
        'Either (claudeSessionId + projectPath) or session parameter is required',
        headers
      );
    }

    const session = sessionManager.getSession(sessionName);
    if (!session) {
      return jsonResponse({ error: 'Session not found', turns: [] }, headers);
    }

    try {
      const turns = await getRecentClaudeTurns(session.cwd, count);
      return jsonResponse({ turns }, headers);
    } catch (error) {
      return errorResponse(String(error), headers, 500);
    }
  }

  // GET /api/claude-quotes/turn/:uuid
  const turnMatch = apiPath.match(/^\/claude-quotes\/turn\/([^/]+)$/);
  if (turnMatch?.[1] && method === 'GET') {
    const uuid = decodeURIComponent(turnMatch[1]);
    const claudeSessionId = params.get('claudeSessionId');
    const projectPath = params.get('projectPath');

    // Use claudeSessionId + projectPath if provided
    if (claudeSessionId && projectPath) {
      try {
        const turn = await getClaudeTurnByUuidFromSession(projectPath, claudeSessionId, uuid);
        return turn ? jsonResponse(turn, headers) : errorResponse('Turn not found', headers, 404);
      } catch (error) {
        return errorResponse(String(error), headers, 500);
      }
    }

    // Fallback: legacy approach
    const sessionName = params.get('session');
    if (!sessionName) {
      return errorResponse(
        'Either (claudeSessionId + projectPath) or session parameter is required',
        headers
      );
    }

    const session = sessionManager.getSession(sessionName);
    if (!session) {
      return errorResponse('Session not found', headers, 404);
    }

    try {
      const turn = await getClaudeTurnByUuid(session.cwd, uuid);
      return turn ? jsonResponse(turn, headers) : errorResponse('Turn not found', headers, 404);
    } catch (error) {
      return errorResponse(String(error), headers, 500);
    }
  }

  // GET /api/claude-quotes/project-markdown
  if (apiPath.startsWith('/claude-quotes/project-markdown') && method === 'GET') {
    const sessionName = params.get('session');
    const count = Math.min(Number.parseInt(params.get('count') ?? '10', 10), 50);

    if (!sessionName) {
      return errorResponse('session parameter required', headers);
    }

    const session = sessionManager.getSession(sessionName);
    if (!session) {
      return jsonResponse({ error: 'Session not found', files: [] }, headers);
    }

    try {
      const allFiles = collectMdFiles(session.cwd, session.cwd, {
        excludeDirs: ['node_modules', '.git', 'dist', 'build', 'coverage'],
        maxDepth: 3
      });
      const files = allFiles
        .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
        .slice(0, count);
      return jsonResponse({ files }, headers);
    } catch (error) {
      return errorResponse(String(error), headers, 500);
    }
  }

  // GET /api/claude-quotes/plans
  if (apiPath.startsWith('/claude-quotes/plans') && method === 'GET') {
    const count = Math.min(Number.parseInt(params.get('count') ?? '10', 10), 50);

    try {
      const files = getPlanFiles(count);
      return jsonResponse({ files }, headers);
    } catch (error) {
      return errorResponse(String(error), headers, 500);
    }
  }

  // GET /api/claude-quotes/file-content
  if (apiPath.startsWith('/claude-quotes/file-content') && method === 'GET') {
    const source = params.get('source');
    const filePath = params.get('path');
    const sessionName = params.get('session');
    const isPreview = params.get('preview') === 'true';

    if (!source || !filePath) {
      return errorResponse('source and path parameters required', headers);
    }

    let baseDir: string;
    if (source === 'plans') {
      baseDir = join(homedir(), '.claude', 'plans');
    } else if (source === 'project') {
      if (!sessionName) {
        return errorResponse('session parameter required for project source', headers);
      }
      const session = sessionManager.getSession(sessionName);
      if (!session) {
        return errorResponse('Session not found', headers, 404);
      }
      baseDir = session.cwd;
    } else {
      return errorResponse('source must be "project" or "plans"', headers);
    }

    const result = readFileContent(baseDir, filePath, isPreview);
    if ('error' in result) {
      return errorResponse(result.error, headers, result.error === 'File not found' ? 404 : 400);
    }

    return jsonResponse(result, headers);
  }

  // GET /api/claude-quotes/git-diff
  if (
    apiPath.startsWith('/claude-quotes/git-diff') &&
    method === 'GET' &&
    !apiPath.includes('/git-diff-file')
  ) {
    const sessionName = params.get('session');
    if (!sessionName) {
      return errorResponse('session parameter required', headers);
    }

    const session = sessionManager.getSession(sessionName);
    if (!session) {
      return errorResponse('Session not found', headers, 404);
    }

    try {
      return jsonResponse(await getGitDiff(session.cwd), headers);
    } catch (error) {
      return errorResponse(String(error), headers, 500);
    }
  }

  // GET /api/claude-quotes/git-diff-file
  if (apiPath.startsWith('/claude-quotes/git-diff-file') && method === 'GET') {
    const sessionName = params.get('session');
    const filePath = params.get('path');

    if (!sessionName || !filePath) {
      return errorResponse('session and path parameters required', headers);
    }

    const session = sessionManager.getSession(sessionName);
    if (!session) {
      return errorResponse('Session not found', headers, 404);
    }

    try {
      const diff = await getFileDiff(session.cwd, filePath);
      return jsonResponse({ path: filePath, diff }, headers);
    } catch (error) {
      return errorResponse(String(error), headers, 500);
    }
  }

  // Not a claude-quotes route
  return null;
}
