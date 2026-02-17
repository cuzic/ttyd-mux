import { isAbsolute, resolve } from 'node:path';
import { type StateStore, defaultStateStore } from '@/config/state-store.js';
import { type ProcessRunner, defaultProcessRunner } from '@/utils/process-runner.js';
import { type SocketClient, defaultSocketClient } from '@/utils/socket-client.js';

const DAEMON_START_TIMEOUT = 5000;
const DAEMON_CHECK_INTERVAL = 100;

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
 * Get current dependencies (for api-client)
 */
export function getDaemonClientDeps(): DaemonClientDeps {
  return currentDeps;
}

/**
 * Check if daemon is running by pinging the socket
 */
export async function isDaemonRunning(): Promise<boolean> {
  const socketPath = currentDeps.stateStore.getSocketPath();

  if (!currentDeps.socketClient.exists(socketPath)) {
    return false;
  }

  return new Promise((resolve) => {
    const socket = currentDeps.socketClient.connect(socketPath);

    socket.on('connect', () => {
      socket.write('ping');
    });

    socket.on('data', (data) => {
      const response = data.toString().trim();
      socket.end();
      resolve(response === 'pong');
    });

    socket.on('error', () => {
      resolve(false);
    });

    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

interface DaemonCommand {
  executable: string;
  args: string[];
}

/**
 * Resolve script path to absolute path
 */
function resolveScriptPath(scriptPath: string | undefined): string {
  if (!scriptPath) return '';
  return isAbsolute(scriptPath) ? scriptPath : resolve(scriptPath);
}

/**
 * Detect how the script is being run
 */
function detectRunMode(): 'bun-run' | 'script' | 'binary' {
  const arg1 = process.argv[1];
  if (arg1 === 'run') return 'bun-run';
  if (arg1?.endsWith('.ts') || arg1?.endsWith('.js')) return 'script';
  if (arg1 && arg1 !== process.execPath) return 'script'; // symlink
  return 'binary';
}

/**
 * Build the command to spawn daemon based on how this script is being run
 */
function buildDaemonCommand(configPath?: string): DaemonCommand {
  const mode = detectRunMode();
  let executable: string;
  let args: string[];

  switch (mode) {
    case 'bun-run':
      executable = process.argv[0] ?? 'bun';
      args = ['run', resolveScriptPath(process.argv[2]), 'daemon', '-f'];
      break;
    case 'script':
      executable = process.argv[0] ?? 'bun';
      args = [resolveScriptPath(process.argv[1]), 'daemon', '-f'];
      break;
    default:
      executable = process.execPath;
      args = ['daemon', '-f'];
  }

  if (configPath) {
    args.push('-c', configPath);
  }

  return { executable, args };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for daemon to become ready
 */
async function waitForDaemon(): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < DAEMON_START_TIMEOUT) {
    if (await isDaemonRunning()) {
      return true;
    }
    await sleep(DAEMON_CHECK_INTERVAL);
  }
  return false;
}

/**
 * Ensure daemon is running, starting it if necessary
 */
export async function ensureDaemon(configPath?: string): Promise<void> {
  if (await isDaemonRunning()) {
    return;
  }

  const { executable, args } = buildDaemonCommand(configPath);

  const child = currentDeps.processRunner.spawn(executable, args, {
    detached: true,
    stdio: 'ignore',
    env: process.env
  });

  child.unref();

  if (!(await waitForDaemon())) {
    throw new Error('Failed to start daemon: timeout');
  }
}

/**
 * Shutdown daemon via socket command
 */
export async function shutdownDaemon(): Promise<void> {
  const socketPath = currentDeps.stateStore.getSocketPath();

  if (!currentDeps.socketClient.exists(socketPath)) {
    return;
  }

  return new Promise((resolve, reject) => {
    const socket = currentDeps.socketClient.connect(socketPath);

    socket.on('connect', () => {
      socket.write('shutdown');
    });

    socket.on('data', (data) => {
      const response = data.toString().trim();
      socket.end();
      if (response === 'ok') {
        resolve();
      } else {
        reject(new Error('Unexpected response'));
      }
    });

    socket.on('error', (err) => {
      reject(err);
    });
  });
}
