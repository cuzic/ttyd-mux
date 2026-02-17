import { spawn } from 'node:child_process';
import { basename } from 'node:path';
import type { TmuxSession } from './types.js';
import { defaultTmuxClient } from './utils/tmux-client.js';

/**
 * Check if currently inside a tmux session
 */
export function isInsideTmux(): boolean {
  return defaultTmuxClient.isInsideTmux();
}

/**
 * Check if tmux is installed
 */
export function isTmuxInstalled(): boolean {
  return defaultTmuxClient.isInstalled();
}

/**
 * List all tmux sessions
 */
export function listSessions(): TmuxSession[] {
  return defaultTmuxClient.listSessions();
}

/**
 * Check if a session exists
 */
export function sessionExists(sessionName: string): boolean {
  return defaultTmuxClient.sessionExists(sessionName);
}

/**
 * Ensure a session exists, creating it if necessary
 */
export function ensureSession(sessionName: string, cwd?: string): void {
  defaultTmuxClient.ensureSession(sessionName, cwd);
}

/**
 * Attach to a tmux session (interactive, spawns child process)
 */
export function attachSession(sessionName: string): Promise<number> {
  return new Promise((resolve) => {
    // Ensure session exists before attaching
    ensureSession(sessionName);

    const command = isInsideTmux() ? 'switch-client' : 'attach-session';

    const tmux = spawn('tmux', [command, '-t', sessionName], {
      stdio: 'inherit'
    });

    tmux.on('close', (code) => {
      resolve(code ?? 0);
    });
  });
}

/**
 * Get session name from current working directory
 */
export function getCwdSessionName(): string {
  return basename(process.cwd());
}

/**
 * Create or attach to a session named after current directory (interactive)
 */
export function createSessionFromCwd(): Promise<number> {
  return new Promise((resolve) => {
    const sessionName = getCwdSessionName();

    const tmux = spawn('tmux', ['new', '-A', '-s', sessionName], {
      stdio: 'inherit'
    });

    tmux.on('close', (code) => {
      resolve(code ?? 0);
    });
  });
}
