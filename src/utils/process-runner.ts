/**
 * ProcessRunner interface for abstracting process spawning
 * Allows mocking in tests without actually spawning processes
 */

import { type ChildProcess, type SpawnOptions, execSync, spawn } from 'node:child_process';

export interface ExecSyncOptions {
  cwd?: string;
  encoding?: 'utf-8' | 'utf8' | 'ascii' | 'base64' | 'hex' | 'latin1' | 'binary';
  stdio?: 'pipe' | 'ignore' | 'inherit';
}

export interface ProcessRunner {
  /**
   * Spawn a child process
   */
  spawn(command: string, args: string[], options?: SpawnOptions): ChildProcess;

  /**
   * Execute a command synchronously
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
}

/**
 * Default implementation using Node.js child_process
 */
export const defaultProcessRunner: ProcessRunner = {
  spawn(command: string, args: string[], options?: SpawnOptions): ChildProcess {
    return spawn(command, args, options ?? {});
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
    execSync: overrides?.execSync ?? (() => ''),
    isProcessRunning: overrides?.isProcessRunning ?? (() => false),
    kill:
      overrides?.kill ??
      (() => {
        /* no-op mock */
      })
  };
}
