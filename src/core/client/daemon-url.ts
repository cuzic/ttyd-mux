/**
 * Daemon URL Resolution
 *
 * Resolves the daemon URL from state or config.
 */

import type { Config } from '@/core/config/types.js';
import { getDaemonClientDeps } from './daemon-client-deps.js';

/**
 * Get daemon URL from state or config
 */
export function getDaemonUrl(config: Config): string {
  const deps = getDaemonClientDeps();
  const daemon = deps.stateStore.getDaemonState();
  const port = daemon?.port ?? config.daemon_port;
  return `http://localhost:${port}`;
}

/**
 * Build a full API URL
 */
export function buildApiUrl(config: Config, path: string): string {
  return `${getDaemonUrl(config)}${path}`;
}
