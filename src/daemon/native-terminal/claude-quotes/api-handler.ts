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

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { validateSecurePath } from '../utils/path-security.js';
import { readJsonlFile } from '../utils/jsonl.js';
import { parseTurnByUuidFromSessionFile, parseTurnsFromSessionFile } from './parsing.js';
import type {
  ClaudeSessionInfo,
  ClaudeTurnFull,
  ClaudeTurnSummary,
  GitDiffFile,
  GitDiffResponse,
  MarkdownFile
} from './types.js';
import type { NativeSessionManager } from '../session-manager.js';

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
  // GET /api/claude-quotes/sessions
  if (apiPath === '/claude-quotes/sessions' && method === 'GET') {
    const params = new URL(req.url).searchParams;
    const limit = Math.min(Number.parseInt(params.get('limit') ?? '10', 10), 20);

    try {
      const sessions = getRecentClaudeSessions(limit);
      return new Response(JSON.stringify({ sessions }), { headers });
    } catch (error) {
      return new Response(JSON.stringify({ error: String(error) }), {
        status: 500,
        headers
      });
    }
  }

  // GET /api/claude-quotes/recent
  if (apiPath.startsWith('/claude-quotes/recent') && method === 'GET') {
    const params = new URL(req.url).searchParams;
    const claudeSessionId = params.get('claudeSessionId');
    const projectPath = params.get('projectPath');
    const count = Math.min(Number.parseInt(params.get('count') ?? '20', 10), 50);

    // New approach: use claudeSessionId and projectPath directly
    if (claudeSessionId && projectPath) {
      try {
        const turns = await getRecentClaudeTurnsFromSession(projectPath, claudeSessionId, count);
        return new Response(JSON.stringify({ turns }), { headers });
      } catch (error) {
        return new Response(JSON.stringify({ error: String(error) }), {
          status: 500,
          headers
        });
      }
    }

    // Fallback: legacy approach using ttyd-mux session name
    const sessionName = params.get('session');
    if (!sessionName) {
      return new Response(
        JSON.stringify({ error: 'Either (claudeSessionId + projectPath) or session parameter is required' }),
        { status: 400, headers }
      );
    }

    const session = sessionManager.getSession(sessionName);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found', turns: [] }), {
        status: 200,
        headers
      });
    }

    try {
      const turns = await getRecentClaudeTurns(session.cwd, count);
      return new Response(JSON.stringify({ turns }), { headers });
    } catch (error) {
      return new Response(JSON.stringify({ error: String(error) }), {
        status: 500,
        headers
      });
    }
  }

  // GET /api/claude-quotes/turn/:uuid
  const turnMatch = apiPath.match(/^\/claude-quotes\/turn\/([^/]+)$/);
  if (turnMatch?.[1] && method === 'GET') {
    const uuid = decodeURIComponent(turnMatch[1]);
    const params = new URL(req.url).searchParams;
    const claudeSessionId = params.get('claudeSessionId');
    const projectPath = params.get('projectPath');

    // New approach: use claudeSessionId and projectPath directly
    if (claudeSessionId && projectPath) {
      try {
        const turn = await getClaudeTurnByUuidFromSession(projectPath, claudeSessionId, uuid);
        if (!turn) {
          return new Response(JSON.stringify({ error: 'Turn not found' }), {
            status: 404,
            headers
          });
        }
        return new Response(JSON.stringify(turn), { headers });
      } catch (error) {
        return new Response(JSON.stringify({ error: String(error) }), {
          status: 500,
          headers
        });
      }
    }

    // Fallback: legacy approach
    const sessionName = params.get('session');
    if (!sessionName) {
      return new Response(
        JSON.stringify({ error: 'Either (claudeSessionId + projectPath) or session parameter is required' }),
        { status: 400, headers }
      );
    }

    const session = sessionManager.getSession(sessionName);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers
      });
    }

    try {
      const turn = await getClaudeTurnByUuid(session.cwd, uuid);
      if (!turn) {
        return new Response(JSON.stringify({ error: 'Turn not found' }), {
          status: 404,
          headers
        });
      }
      return new Response(JSON.stringify(turn), { headers });
    } catch (error) {
      return new Response(JSON.stringify({ error: String(error) }), {
        status: 500,
        headers
      });
    }
  }

  // GET /api/claude-quotes/project-markdown
  if (apiPath.startsWith('/claude-quotes/project-markdown') && method === 'GET') {
    const params = new URL(req.url).searchParams;
    const sessionName = params.get('session');
    const count = Math.min(Number.parseInt(params.get('count') ?? '10', 10), 50);

    if (!sessionName) {
      return new Response(JSON.stringify({ error: 'session parameter required' }), {
        status: 400,
        headers
      });
    }

    const session = sessionManager.getSession(sessionName);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found', files: [] }), {
        status: 200,
        headers
      });
    }

    try {
      const allFiles = collectMdFiles(session.cwd, session.cwd, {
        excludeDirs: ['node_modules', '.git', 'dist', 'build', 'coverage'],
        maxDepth: 3
      });

      // Sort by modified time (most recent first) and limit
      const files = allFiles
        .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
        .slice(0, count);

      return new Response(JSON.stringify({ files }), { headers });
    } catch (error) {
      return new Response(JSON.stringify({ error: String(error) }), {
        status: 500,
        headers
      });
    }
  }

  // GET /api/claude-quotes/plans
  if (apiPath.startsWith('/claude-quotes/plans') && method === 'GET') {
    const params = new URL(req.url).searchParams;
    const count = Math.min(Number.parseInt(params.get('count') ?? '10', 10), 50);

    try {
      const plansDir = join(homedir(), '.claude', 'plans');
      if (!existsSync(plansDir)) {
        return new Response(JSON.stringify({ files: [] }), { headers });
      }

      const files: MarkdownFile[] = readdirSync(plansDir)
        .filter((f) => f.endsWith('.md'))
        .map((f) => {
          const fullPath = join(plansDir, f);
          const stat = statSync(fullPath);
          return {
            path: f,
            name: f,
            modifiedAt: stat.mtime.toISOString(),
            size: stat.size
          };
        })
        .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
        .slice(0, count);

      return new Response(JSON.stringify({ files }), { headers });
    } catch (error) {
      return new Response(JSON.stringify({ error: String(error) }), {
        status: 500,
        headers
      });
    }
  }

  // GET /api/claude-quotes/file-content
  if (apiPath.startsWith('/claude-quotes/file-content') && method === 'GET') {
    const params = new URL(req.url).searchParams;
    const source = params.get('source');
    const filePath = params.get('path');
    const sessionName = params.get('session');

    if (!source || !filePath) {
      return new Response(JSON.stringify({ error: 'source and path parameters required' }), {
        status: 400,
        headers
      });
    }

    let baseDir: string;
    if (source === 'plans') {
      baseDir = join(homedir(), '.claude', 'plans');
    } else if (source === 'project') {
      if (!sessionName) {
        return new Response(JSON.stringify({ error: 'session parameter required for project source' }), {
          status: 400,
          headers
        });
      }
      const session = sessionManager.getSession(sessionName);
      if (!session) {
        return new Response(JSON.stringify({ error: 'Session not found' }), {
          status: 404,
          headers
        });
      }
      baseDir = session.cwd;
    } else {
      return new Response(JSON.stringify({ error: 'source must be "project" or "plans"' }), {
        status: 400,
        headers
      });
    }

    const pathResult = validateSecurePath(baseDir, filePath);
    if (!pathResult.valid) {
      return new Response(JSON.stringify({ error: pathResult.error }), {
        status: 400,
        headers
      });
    }
    const targetPath = pathResult.targetPath;

    if (!existsSync(targetPath)) {
      return new Response(JSON.stringify({ error: 'File not found' }), {
        status: 404,
        headers
      });
    }

    // Limit to first 200 lines
    const fullContent = readFileSync(targetPath, 'utf-8');
    const lines = fullContent.split('\n');
    const maxLines = 200;
    const truncated = lines.length > maxLines;
    const content = truncated ? lines.slice(0, maxLines).join('\n') : fullContent;

    return new Response(
      JSON.stringify({
        content,
        truncated,
        totalLines: lines.length
      }),
      { headers }
    );
  }

  // GET /api/claude-quotes/git-diff
  if (apiPath.startsWith('/claude-quotes/git-diff') && method === 'GET' && !apiPath.includes('/git-diff-file')) {
    const params = new URL(req.url).searchParams;
    const sessionName = params.get('session');

    if (!sessionName) {
      return new Response(JSON.stringify({ error: 'session parameter required' }), {
        status: 400,
        headers
      });
    }

    const session = sessionManager.getSession(sessionName);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers
      });
    }

    try {
      const diff = await getGitDiff(session.cwd);
      return new Response(JSON.stringify(diff), { headers });
    } catch (error) {
      return new Response(JSON.stringify({ error: String(error) }), {
        status: 500,
        headers
      });
    }
  }

  // GET /api/claude-quotes/git-diff-file
  if (apiPath.startsWith('/claude-quotes/git-diff-file') && method === 'GET') {
    const params = new URL(req.url).searchParams;
    const sessionName = params.get('session');
    const filePath = params.get('path');

    if (!sessionName || !filePath) {
      return new Response(JSON.stringify({ error: 'session and path parameters required' }), {
        status: 400,
        headers
      });
    }

    const session = sessionManager.getSession(sessionName);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers
      });
    }

    try {
      const diff = await getFileDiff(session.cwd, filePath);
      return new Response(JSON.stringify({ path: filePath, diff }), { headers });
    } catch (error) {
      return new Response(JSON.stringify({ error: String(error) }), {
        status: 500,
        headers
      });
    }
  }

  // Not a claude-quotes route
  return null;
}

// === Helper Functions ===

/**
 * Get recent Claude sessions from ~/.claude/history.jsonl
 */
function getRecentClaudeSessions(limit: number = 10): ClaudeSessionInfo[] {
  const historyPath = join(homedir(), '.claude', 'history.jsonl');
  if (!existsSync(historyPath)) {
    return [];
  }

  const entries = readJsonlFile<HistoryEntry>(historyPath);

  // Group by sessionId, keeping most recent entry per session
  const sessionMap = new Map<string, ClaudeSessionInfo>();

  for (const entry of entries) {
    if (!entry.sessionId || !entry.project) continue;

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
async function getRecentClaudeTurns(projectDir: string, count: number): Promise<ClaudeTurnSummary[]> {
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
async function getClaudeTurnByUuid(projectDir: string, uuid: string): Promise<ClaudeTurnFull | null> {
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
async function getGitDiff(cwd: string): Promise<GitDiffResponse> {
  const { spawn } = await import('node:child_process');

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
      const lines = stdout.trim().split('\n').filter((l) => l.trim());

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
async function getFullDiff(cwd: string): Promise<string> {
  const { spawn } = await import('node:child_process');

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
async function getFileDiff(cwd: string, filePath: string): Promise<string> {
  const { spawn } = await import('node:child_process');

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
