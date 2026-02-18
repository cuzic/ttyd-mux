/**
 * ProcessRunner interface for abstracting process spawning
 * Allows mocking in tests without actually spawning processes
 */

import {
  type ChildProcess,
  type SpawnOptions,
  type SpawnSyncReturns,
  execSync,
  spawn,
  spawnSync
} from 'node:child_process';
import { createServer } from 'node:net';

export interface ExecSyncOptions {
  cwd?: string;
  encoding?: 'utf-8' | 'utf8' | 'ascii' | 'base64' | 'hex' | 'latin1' | 'binary';
  stdio?: 'pipe' | 'ignore' | 'inherit';
}

export interface SpawnSyncOptions {
  cwd?: string;
  stdio?: 'pipe' | 'ignore' | 'inherit';
}

export interface ProcessRunner {
  /**
   * Spawn a child process
   */
  spawn(command: string, args: string[], options?: SpawnOptions): ChildProcess;

  /**
   * Spawn a command synchronously with array arguments (safe from injection)
   */
  spawnSync(command: string, args: string[], options?: SpawnSyncOptions): SpawnSyncReturns<string>;

  /**
   * Execute a command synchronously
   * @deprecated Use spawnSync with array arguments to prevent command injection
   */
  execSync(command: string, options?: ExecSyncOptions): string;

  /**
   * Check if a process with the given PID is running
   */
  isProcessRunning(pid: number): boolean;

  /**
   * Send a signal to a process
   */
  kill(pid: number, signal?: NodeJS.Signals | number): void;

  /**
   * Check if a port is available (not in use)
   */
  isPortAvailable(port: number): Promise<boolean>;
}

/**
 * Default implementation using Node.js child_process
 */
export const defaultProcessRunner: ProcessRunner = {
  spawn(command: string, args: string[], options?: SpawnOptions): ChildProcess {
    return spawn(command, args, options ?? {});
  },

  spawnSync(command: string, args: string[], options?: SpawnSyncOptions): SpawnSyncReturns<string> {
    return spawnSync(command, args, {
      ...options,
      encoding: 'utf-8'
    });
  },

  execSync(command: string, options?: ExecSyncOptions): string {
    return execSync(command, {
      ...options,
      encoding: options?.encoding ?? 'utf-8'
    }) as string;
  },

  isProcessRunning(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  },

  kill(pid: number, signal?: NodeJS.Signals | number): void {
    process.kill(pid, signal);
  },

  isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = createServer();
      server.once('error', () => {
        resolve(false);
      });
      server.once('listening', () => {
        server.close(() => {
          resolve(true);
        });
      });
      server.listen(port, '127.0.0.1');
    });
  }
};

/**
 * Create a mock ProcessRunner for testing
 */
export function createMockProcessRunner(overrides?: Partial<ProcessRunner>): ProcessRunner {
  return {
    spawn:
      overrides?.spawn ??
      (() => {
        throw new Error('spawn not mocked');
      }),
    spawnSync:
      overrides?.spawnSync ??
      (() => ({ status: 0, stdout: '', stderr: '', pid: 0, output: [], signal: null })),
    execSync: overrides?.execSync ?? (() => ''),
    isProcessRunning: overrides?.isProcessRunning ?? (() => false),
    kill:
      overrides?.kill ??
      (() => {
        /* no-op mock */
      }),
    isPortAvailable: overrides?.isPortAvailable ?? (() => Promise.resolve(true))
  };
}
