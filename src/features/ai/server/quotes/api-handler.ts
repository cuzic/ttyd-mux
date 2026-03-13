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

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import type { NativeSessionManager } from '@/core/server/session-manager.js';
import { readJsonlFile } from '@/utils/jsonl.js';
import { validateSecurePath } from '@/utils/path-security.js';
import { parseTurnByUuidFromSessionFile, parseTurnsFromSessionFile } from './parsing.js';
import type {
  ClaudeSessionInfo,
  ClaudeTurnFull,
  ClaudeTurnSummary,
  GitDiffFile,
  GitDiffResponse,
  MarkdownFile
} from './types.js';

/** JSON response helper */
const jsonResponse = (data: unknown, headers: Record<string, string>, status = 200) =>
  new Response(JSON.stringify(data), { status, headers });

/** Error response helper */
const errorResponse = (error: string, headers: Record<string, string>, status = 400) =>
  new Response(JSON.stringify({ error }), { status, headers });

/**
 * History.jsonl entry structure
 */
interface HistoryEntry {
  sessionId?: string;
  project?: string;
  timestamp?: number;
  display?: string;
}

/**
 * Options for collecting markdown files
 */
interface CollectOptions {
  excludeDirs?: string[];
  maxDepth?: number;
}

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
      const plansDir = join(homedir(), '.claude', 'plans');
      if (!existsSync(plansDir)) {
        return jsonResponse({ files: [] }, headers);
      }

      const files: MarkdownFile[] = readdirSync(plansDir)
        .filter((f) => f.endsWith('.md'))
        .map((f) => {
          const fullPath = join(plansDir, f);
          const stat = statSync(fullPath);
          return { path: f, name: f, modifiedAt: stat.mtime.toISOString(), size: stat.size };
        })
        .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
        .slice(0, count);

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

    const pathResult = validateSecurePath(baseDir, filePath);
    if (!pathResult.valid) {
      return errorResponse(pathResult.error ?? 'Invalid path', headers);
    }

    if (!existsSync(pathResult.targetPath)) {
      return errorResponse('File not found', headers, 404);
    }

    const fullContent = readFileSync(pathResult.targetPath, 'utf-8');
    const lines = fullContent.split('\n');
    // Use 30 lines for preview, 200 for full content
    const maxLines = isPreview ? 30 : 200;
    const truncated = lines.length > maxLines;

    return jsonResponse(
      {
        content: truncated ? lines.slice(0, maxLines).join('\n') : fullContent,
        truncated,
        totalLines: lines.length
      },
      headers
    );
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

// === Helper Functions ===

/**
 * Get recent Claude sessions from ~/.claude/history.jsonl
 */
function getRecentClaudeSessions(limit = 10): ClaudeSessionInfo[] {
  const historyPath = join(homedir(), '.claude', 'history.jsonl');
  if (!existsSync(historyPath)) {
    return [];
  }

  const entries = readJsonlFile<HistoryEntry>(historyPath);

  // Group by sessionId, keeping most recent entry per session
  const sessionMap = new Map<string, ClaudeSessionInfo>();

  for (const entry of entries) {
    if (!entry.sessionId || !entry.project) {
      continue;
    }

    const existing = sessionMap.get(entry.sessionId);
    if (!existing || (entry.timestamp ?? 0) > existing.lastTimestamp) {
      sessionMap.set(entry.sessionId, {
        sessionId: entry.sessionId,
        projectPath: entry.project,
        projectName: basename(entry.project),
        lastMessage: entry.display?.slice(0, 100) || '',
        lastTimestamp: entry.timestamp ?? 0
      });
    }
  }

  return Array.from(sessionMap.values())
    .sort((a, b) => b.lastTimestamp - a.lastTimestamp)
    .slice(0, limit);
}

/**
 * Convert project path to Claude slug
 */
function projectPathToSlug(projectPath: string): string {
  return projectPath.replace(/\//g, '-');
}

/**
 * Get Claude session file path from history.jsonl data
 */
function getClaudeSessionFilePath(projectPath: string, sessionId: string): string | null {
  const slug = projectPathToSlug(projectPath);
  const sessionFile = join(homedir(), '.claude', 'projects', slug, `${sessionId}.jsonl`);

  if (existsSync(sessionFile)) {
    return sessionFile;
  }

  return null;
}

/**
 * Find Claude project slug for a directory
 */
function findClaudeProjectSlug(projectDir: string): string | null {
  const claudeProjectsDir = join(homedir(), '.claude', 'projects');

  if (!existsSync(claudeProjectsDir)) {
    return null;
  }

  const normalizedDir = projectDir.replace(/\/+$/, '');
  const expectedSlug = normalizedDir.replace(/\//g, '-');

  if (existsSync(join(claudeProjectsDir, expectedSlug))) {
    return expectedSlug;
  }

  return null;
}

/**
 * Find most recent session file in a project directory
 */
function findRecentSessionFile(projectDir: string): string | null {
  const slug = findClaudeProjectSlug(projectDir);
  if (!slug) {
    return null;
  }

  const projectSlugDir = join(homedir(), '.claude', 'projects', slug);
  if (!existsSync(projectSlugDir)) {
    return null;
  }

  try {
    const files = readdirSync(projectSlugDir)
      .filter((f) => f.endsWith('.jsonl') && !f.startsWith('history'))
      .map((f) => ({
        name: f,
        path: join(projectSlugDir, f),
        mtime: statSync(join(projectSlugDir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.mtime - a.mtime);

    return files[0]?.path ?? null;
  } catch {
    return null;
  }
}

/**
 * Get recent Claude turns (legacy approach)
 */
async function getRecentClaudeTurns(
  projectDir: string,
  count: number
): Promise<ClaudeTurnSummary[]> {
  const sessionFile = findRecentSessionFile(projectDir);
  if (!sessionFile) {
    return [];
  }
  return parseTurnsFromSessionFile(sessionFile, count);
}

/**
 * Get recent Claude turns from specific session
 */
async function getRecentClaudeTurnsFromSession(
  projectPath: string,
  sessionId: string,
  count: number
): Promise<ClaudeTurnSummary[]> {
  const sessionFile = getClaudeSessionFilePath(projectPath, sessionId);
  if (!sessionFile) {
    return [];
  }
  return parseTurnsFromSessionFile(sessionFile, count);
}

/**
 * Get full turn by UUID (legacy approach)
 */
async function getClaudeTurnByUuid(
  projectDir: string,
  uuid: string
): Promise<ClaudeTurnFull | null> {
  const sessionFile = findRecentSessionFile(projectDir);
  if (!sessionFile) {
    return null;
  }
  return parseTurnByUuidFromSessionFile(sessionFile, uuid);
}

/**
 * Get full turn by UUID from specific session
 */
async function getClaudeTurnByUuidFromSession(
  projectPath: string,
  sessionId: string,
  uuid: string
): Promise<ClaudeTurnFull | null> {
  const sessionFile = getClaudeSessionFilePath(projectPath, sessionId);
  if (!sessionFile) {
    return null;
  }
  return parseTurnByUuidFromSessionFile(sessionFile, uuid);
}

/**
 * Collect markdown files from a directory
 */
function collectMdFiles(
  dir: string,
  baseDir: string,
  options: CollectOptions = {},
  currentDepth = 0
): MarkdownFile[] {
  const { excludeDirs = [], maxDepth = 5 } = options;

  if (currentDepth > maxDepth) {
    return [];
  }

  const files: MarkdownFile[] = [];

  try {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!excludeDirs.includes(entry.name) && !entry.name.startsWith('.')) {
          files.push(...collectMdFiles(fullPath, baseDir, options, currentDepth + 1));
        }
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const stat = statSync(fullPath);
        const relativePath = fullPath.slice(baseDir.length + 1);
        files.push({
          path: relativePath,
          relativePath,
          name: entry.name,
          modifiedAt: stat.mtime.toISOString(),
          size: stat.size
        });
      }
    }
  } catch {
    // Skip directories we can't read
  }

  return files;
}

/**
 * Get git diff information
 */
function getGitDiff(cwd: string): Promise<GitDiffResponse> {
  return new Promise((resolve) => {
    // Get both staged and unstaged changes
    const proc = spawn('git', ['diff', '--numstat', 'HEAD'], { cwd });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', async (code) => {
      if (code !== 0) {
        resolve({ files: [], fullDiff: '', summary: stderr || 'No git repository' });
        return;
      }

      // Parse numstat output
      const files: GitDiffFile[] = [];
      const lines = stdout
        .trim()
        .split('\n')
        .filter((l) => l.trim());

      for (const line of lines) {
        const [additions, deletions, path] = line.split('\t');
        if (path) {
          files.push({
            path,
            status: 'M' as const, // Simplified - could detect A/D/R
            additions: Number.parseInt(additions ?? '0', 10) || 0,
            deletions: Number.parseInt(deletions ?? '0', 10) || 0
          });
        }
      }

      // Get full diff (limited size)
      const fullDiff = await getFullDiff(cwd);

      const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
      const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);
      const summary = `${files.length} files, +${totalAdditions}/-${totalDeletions}`;

      resolve({ files, fullDiff, summary });
    });

    proc.on('error', () => {
      resolve({ files: [], fullDiff: '', summary: 'Git not available' });
    });
  });
}

/**
 * Get full git diff (limited to 50KB)
 */
function getFullDiff(cwd: string): Promise<string> {
  return new Promise((resolve) => {
    // Include both staged and unstaged changes
    const stagedProc = spawn('git', ['diff', '--staged'], { cwd });
    const unstagedProc = spawn('git', ['diff'], { cwd });

    let staged = '';
    let unstaged = '';

    stagedProc.stdout.on('data', (data) => {
      staged += data.toString();
    });

    unstagedProc.stdout.on('data', (data) => {
      unstaged += data.toString();
    });

    let completed = 0;
    const checkComplete = () => {
      completed++;
      if (completed === 2) {
        const combined = staged + unstaged;
        // Limit to 50KB
        resolve(combined.slice(0, 50 * 1024));
      }
    };

    stagedProc.on('close', checkComplete);
    unstagedProc.on('close', checkComplete);
    stagedProc.on('error', () => resolve(staged.trim()));
  });
}

/**
 * Get diff for a specific file
 */
function getFileDiff(cwd: string, filePath: string): Promise<string> {
  return new Promise((resolve) => {
    const proc = spawn('git', ['diff', 'HEAD', '--', filePath], { cwd });

    let stdout = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.on('close', () => {
      resolve(stdout.trim());
    });

    proc.on('error', () => {
      resolve('');
    });
  });
}
