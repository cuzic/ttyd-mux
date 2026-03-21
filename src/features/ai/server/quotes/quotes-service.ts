/**
 * Claude Quotes Service
 *
 * Business logic for Claude quote operations.
 * Handles Claude session discovery, turn retrieval, and file operations.
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
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
interface CollectMdOptions {
  excludeDirs?: string[];
  maxDepth?: number;
}

/**
 * File content result
 */
export interface FileContentResult {
  content: string;
  truncated: boolean;
  totalLines: number;
}

// === Claude Session Discovery ===

/**
 * Get recent Claude sessions from ~/.claude/history.jsonl
 */
export function getRecentClaudeSessions(limit = 10): ClaudeSessionInfo[] {
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

// === Session Path Resolution ===

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

// === Turn Retrieval ===

/**
 * Get recent Claude turns (legacy approach using project directory)
 */
export async function getRecentClaudeTurns(
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
export async function getRecentClaudeTurnsFromSession(
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
export async function getClaudeTurnByUuid(
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
export async function getClaudeTurnByUuidFromSession(
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

// === Markdown File Operations ===

/**
 * Collect markdown files from a directory
 */
export function collectMdFiles(
  dir: string,
  baseDir: string,
  options: CollectMdOptions = {},
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
 * Get plan files from ~/.claude/plans
 */
export function getPlanFiles(count: number): MarkdownFile[] {
  const plansDir = join(homedir(), '.claude', 'plans');
  if (!existsSync(plansDir)) {
    return [];
  }

  return readdirSync(plansDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const fullPath = join(plansDir, f);
      const stat = statSync(fullPath);
      return { path: f, name: f, modifiedAt: stat.mtime.toISOString(), size: stat.size };
    })
    .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
    .slice(0, count);
}

/**
 * Read file content with optional truncation
 */
export function readFileContent(
  baseDir: string,
  filePath: string,
  isPreview: boolean
): FileContentResult | { error: string } {
  const pathResult = validateSecurePath(baseDir, filePath);
  if (!pathResult.valid) {
    return { error: pathResult.error ?? 'Invalid path' };
  }

  if (!existsSync(pathResult.targetPath)) {
    return { error: 'File not found' };
  }

  const fullContent = readFileSync(pathResult.targetPath, 'utf-8');
  const lines = fullContent.split('\n');
  // Use 30 lines for preview, 200 for full content
  const maxLines = isPreview ? 30 : 200;
  const truncated = lines.length > maxLines;

  return {
    content: truncated ? lines.slice(0, maxLines).join('\n') : fullContent,
    truncated,
    totalLines: lines.length
  };
}

// === Git Operations ===

/**
 * Get git diff information
 */
export function getGitDiff(cwd: string): Promise<GitDiffResponse> {
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
export function getFileDiff(cwd: string, filePath: string): Promise<string> {
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
