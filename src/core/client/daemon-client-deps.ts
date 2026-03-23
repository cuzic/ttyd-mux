/**
 * Daemon Client Dependencies
 *
 * Dependency injection infrastructure for daemon client.
 * Allows mocking dependencies for testing.
 */

import { defaultStateStore, type StateStore } from '@/core/config/state-store.js';
import { defaultProcessRunner, type ProcessRunner } from '@/utils/process-runner.js';
import { defaultSocketClient, type SocketClient } from '@/utils/socket-client.js';

/**
 * Dependencies for DaemonClient (for testing)
 */
export interface DaemonClientDeps {
  stateStore: StateStore;
  socketClient: SocketClient;
  processRunner: ProcessRunner;
}

/**
 * Default dependencies using real implementations
 */
export const defaultDaemonClientDeps: DaemonClientDeps = {
  stateStore: defaultStateStore,
  socketClient: defaultSocketClient,
  processRunner: defaultProcessRunner
};

// Module-level deps (allows dependency injection for testing)
let currentDeps: DaemonClientDeps = defaultDaemonClientDeps;

/**
 * Set dependencies (for testing)
 */
export function setDaemonClientDeps(deps: Partial<DaemonClientDeps>): void {
  currentDeps = { ...defaultDaemonClientDeps, ...deps };
}

/**
 * Reset dependencies to defaults
 */
export function resetDaemonClientDeps(): void {
  currentDeps = defaultDaemonClientDeps;
}

/**
 * Get current dependencies
 */
export function getDaemonClientDeps(): DaemonClientDeps {
  return currentDeps;
}
