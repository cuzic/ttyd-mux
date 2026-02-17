/**
 * TmuxClient interface for abstracting tmux interactions
 * Allows mocking in tests without actual tmux commands
 */

import type { TmuxSession } from '@/types.js';
import { type ProcessRunner, defaultProcessRunner } from './process-runner.js';

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

export interface TmuxClient {
  /**
   * Check if currently inside a tmux session
   */
  isInsideTmux(): boolean;

  /**
   * Check if tmux is installed
   */
  isInstalled(): boolean;

  /**
   * List all tmux sessions
   */
  listSessions(): TmuxSession[];

  /**
   * Check if a session exists
   */
  sessionExists(sessionName: string): boolean;

  /**
   * Ensure a session exists, creating it if necessary
   */
  ensureSession(sessionName: string, cwd?: string): void;
}

/**
 * Create a TmuxClient with optional ProcessRunner injection
 */
export function createTmuxClient(processRunner: ProcessRunner = defaultProcessRunner): TmuxClient {
  return {
    isInsideTmux(): boolean {
      return !!process.env['TMUX'];
    },

    isInstalled(): boolean {
      try {
        processRunner.execSync('which tmux', { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    },

    listSessions(): TmuxSession[] {
      try {
        const output = processRunner.execSync(`tmux list-sessions -F "${SESSION_FORMAT}"`, {
          encoding: 'utf-8'
        });
        return output
          .trim()
          .split('\n')
          .filter((line) => line.length > 0)
          .map(parseSessionLine);
      } catch {
        return [];
      }
    },

    sessionExists(sessionName: string): boolean {
      try {
        processRunner.execSync(`tmux has-session -t ${sessionName}`, { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    },

    ensureSession(sessionName: string, cwd?: string): void {
      if (!this.sessionExists(sessionName)) {
        const cwdOption = cwd ? ` -c "${cwd}"` : '';
        processRunner.execSync(`tmux new-session -d -s ${sessionName}${cwdOption}`, {
          stdio: 'ignore'
        });
      }
    }
  };
}

/**
 * Default TmuxClient using real tmux commands
 */
export const defaultTmuxClient: TmuxClient = createTmuxClient();

/**
 * Create a mock TmuxClient for testing
 */
export function createMockTmuxClient(overrides?: Partial<TmuxClient>): TmuxClient {
  return {
    isInsideTmux: overrides?.isInsideTmux ?? (() => false),
    isInstalled: overrides?.isInstalled ?? (() => true),
    listSessions: overrides?.listSessions ?? (() => []),
    sessionExists: overrides?.sessionExists ?? (() => false),
    ensureSession:
      overrides?.ensureSession ??
      (() => {
        /* no-op mock */
      })
  };
}
