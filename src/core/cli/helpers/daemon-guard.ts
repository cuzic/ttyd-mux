/**
 * Daemon Guard
 *
 * Common patterns for daemon availability checks in CLI commands.
 */

import { isDaemonRunning } from '@/core/client/index.js';
import { daemonNotRunning, type DaemonNotRunningError } from '@/core/errors.js';
import { err, ok, type Result } from '@/utils/result.js';

export interface DaemonGuardOptions {
  json?: boolean;
  /** Custom hint when daemon is not running (default: 'Run "bunterm up" to start a session.') */
  hint?: string;
  /** Suppress console output (for commands that handle output themselves) */
  silent?: boolean;
}

export interface DaemonNotRunningResult {
  running: false;
}

export interface DaemonRunningResult {
  running: true;
}

export type DaemonGuardResult = DaemonNotRunningResult | DaemonRunningResult;

/**
 * Check if daemon is running and handle the not-running case.
 * Returns { running: false } if daemon is not running (and outputs appropriate message unless silent).
 * Returns { running: true } if daemon is running.
 */
export async function guardDaemon(options: DaemonGuardOptions = {}): Promise<DaemonGuardResult> {
  if (await isDaemonRunning()) {
    return { running: true };
  }

  if (!options.silent) {
    if (options.json) {
      console.log(JSON.stringify({ daemon: false, sessions: [] }));
    } else {
      console.log('Daemon is not running.');
      console.log(options.hint ?? 'Run "bunterm up" to start a session.');
    }
  }

  return { running: false };
}

// === Result-returning version ===

/**
 * Check if daemon is running, returning Result.
 * Use this for pure service logic without console output.
 */
export async function checkDaemonRunning(): Promise<Result<true, DaemonNotRunningError>> {
  if (await isDaemonRunning()) {
    return ok(true);
  }
  return err(daemonNotRunning());
}
