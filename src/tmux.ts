import { execSync, spawn } from 'node:child_process';
import { basename } from 'node:path';
import type { TmuxSession } from './types.js';

export function isInsideTmux(): boolean {
  return !!process.env['TMUX'];
}

export function isTmuxInstalled(): boolean {
  try {
    execSync('which tmux', { stdio: 'ignore' });
    return true;
  } catch {
    // Expected: tmux is not installed
    return false;
  }
}

const SESSION_FORMAT = '#{session_name}|#{session_windows}|#{session_created}|#{session_attached}';

function parseSessionLine(line: string): TmuxSession {
  const [name = '', windows = '0', created = '0', attached] = line.split('|');
  return {
    name,
    windows: Number.parseInt(windows, 10),
    created: new Date(Number.parseInt(created, 10) * 1000),
    attached: attached === '1'
  };
}

export function listSessions(): TmuxSession[] {
  try {
    const output = execSync(`tmux list-sessions -F "${SESSION_FORMAT}"`, { encoding: 'utf-8' });
    return output
      .trim()
      .split('\n')
      .filter((line) => line.length > 0)
      .map(parseSessionLine);
  } catch {
    // Expected: no tmux server running or no sessions
    return [];
  }
}

export function sessionExists(sessionName: string): boolean {
  try {
    execSync(`tmux has-session -t ${sessionName}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function ensureSession(sessionName: string): void {
  if (!sessionExists(sessionName)) {
    // Create detached session
    execSync(`tmux new-session -d -s ${sessionName}`, { stdio: 'ignore' });
  }
}

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

export function getCwdSessionName(): string {
  return basename(process.cwd());
}

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
