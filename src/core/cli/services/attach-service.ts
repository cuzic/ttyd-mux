/**
 * Attach Service
 *
 * Session discovery and tmux attach operations.
 */

import { execSync, spawn } from 'node:child_process';
import { getSessions, isDaemonRunning } from '@/core/client/index.js';
import { loadConfig } from '@/core/config/config.js';

/**
 * Discovered session info
 */
export interface DiscoveredSession {
  name: string;
  dir: string;
  source: 'daemon' | 'tmux';
}

/**
 * Check if tmux is installed on the system
 */
export function isTmuxInstalled(): boolean {
  try {
    execSync('which tmux', { stdio: ['pipe', 'pipe', 'pipe'] });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get tmux sessions directly
 */
export function getTmuxSessions(): string[] {
  try {
    const output = execSync('tmux list-sessions -F "#{session_name}"', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return output
      .trim()
      .split('\n')
      .filter((s) => s.length > 0);
  } catch {
    return [];
  }
}

/**
 * Discover all available sessions from daemon and tmux
 */
export async function discoverSessions(configPath?: string): Promise<DiscoveredSession[]> {
  const sessions: DiscoveredSession[] = [];
  const seenNames = new Set<string>();

  // Get sessions from daemon if running
  const running = await isDaemonRunning();
  if (running) {
    try {
      const daemonSessions = await getSessions(loadConfig(configPath));
      for (const session of daemonSessions) {
        sessions.push({
          name: session.name,
          dir: session.dir,
          source: 'daemon'
        });
        seenNames.add(session.name);
      }
    } catch {
      // Ignore errors
    }
  }

  // Add tmux sessions not already discovered
  const tmuxSessions = getTmuxSessions();
  for (const name of tmuxSessions) {
    if (!seenNames.has(name)) {
      sessions.push({
        name,
        dir: '',
        source: 'tmux'
      });
    }
  }

  return sessions;
}

/**
 * Attach to a tmux session
 * Returns a promise that resolves when tmux exits
 */
export function attachToTmuxSession(name: string): Promise<number> {
  const insideTmux = !!process.env['TMUX'];
  const args = insideTmux ? ['switch-client', '-t', name] : ['attach-session', '-t', name];

  return new Promise((resolve) => {
    const tmux = spawn('tmux', args, {
      stdio: 'inherit'
    });

    tmux.on('exit', (code) => {
      resolve(code ?? 0);
    });

    tmux.on('error', () => {
      resolve(1);
    });
  });
}
