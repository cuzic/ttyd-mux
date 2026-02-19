/**
 * TmuxClient interface for abstracting tmux interactions
 * Allows mocking in tests without actual tmux commands
 */

import { type ProcessRunner, defaultProcessRunner } from './process-runner.js';

/**
 * Represents a tmux session
 */
export interface TmuxSession {
  name: string;
  windows: number;
  created: Date;
  attached: boolean;
}

const SESSION_FORMAT = '#{session_name}|#{session_windows}|#{session_created}|#{session_attached}';

/**
 * Valid session name pattern: alphanumeric, underscore, hyphen, dot (max 64 chars)
 * Prevents command injection attacks
 */
const VALID_SESSION_NAME = /^[a-zA-Z0-9_.-]{1,64}$/;

/**
 * Validate session name to prevent command injection
 */
export function isValidSessionName(name: string): boolean {
  return VALID_SESSION_NAME.test(name);
}

/**
 * Sanitize session name by removing invalid characters
 */
export function sanitizeSessionName(name: string): string {
  // Replace invalid characters with hyphen, then collapse multiple hyphens
  return (
    name
      .replace(/[^a-zA-Z0-9_.-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 64) || 'session'
  );
}

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

  /**
   * Kill a tmux session
   */
  killSession(sessionName: string): boolean;
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
      if (!isValidSessionName(sessionName)) {
        return false;
      }
      // Use spawnSync with array arguments to prevent command injection
      const result = processRunner.spawnSync('tmux', ['has-session', '-t', sessionName], {
        stdio: 'ignore'
      });
      return result.status === 0;
    },

    ensureSession(sessionName: string, cwd?: string): void {
      if (!isValidSessionName(sessionName)) {
        throw new Error(`Invalid session name: ${sessionName}`);
      }
      if (!this.sessionExists(sessionName)) {
        // Use spawnSync with array arguments to prevent command injection
        const args = ['new-session', '-d', '-s', sessionName];
        if (cwd) {
          args.push('-c', cwd);
        }
        const result = processRunner.spawnSync('tmux', args, { stdio: 'ignore' });
        if (result.status !== 0) {
          throw new Error(`Failed to create tmux session: ${sessionName}`);
        }
      }
    },

    killSession(sessionName: string): boolean {
      if (!isValidSessionName(sessionName)) {
        return false;
      }
      const result = processRunner.spawnSync('tmux', ['kill-session', '-t', sessionName], {
        stdio: 'ignore'
      });
      return result.status === 0;
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
      }),
    killSession: overrides?.killSession ?? (() => true)
  };
}
