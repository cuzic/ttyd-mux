import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { connect } from 'node:net';
import { getDaemonState, getSocketPath } from '../config/state.js';
import type {
  Config,
  SessionResponse,
  StartSessionRequest,
  StatusResponse
} from '../config/types.js';

const DAEMON_START_TIMEOUT = 5000;
const DAEMON_CHECK_INTERVAL = 100;

export async function isDaemonRunning(): Promise<boolean> {
  const socketPath = getSocketPath();

  if (!existsSync(socketPath)) {
    return false;
  }

  return new Promise((resolve) => {
    const socket = connect(socketPath);

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

export async function ensureDaemon(configPath?: string): Promise<void> {
  if (await isDaemonRunning()) {
    return;
  }

  // Build command to spawn daemon in background
  // For 'bun run src/index.ts': argv[1] ends with '.ts' or is 'run'
  // For compiled binary: execPath is the binary itself
  let executable: string;
  let args: string[];

  const isBunRun = process.argv[1] === 'run' || process.argv[1]?.endsWith('.ts');
  if (isBunRun) {
    // Running via 'bun run' or 'bun src/index.ts'
    executable = process.argv[0] ?? 'bun';
    args = process.argv.slice(1, 3).concat(['daemon', '-f']);
  } else {
    // Compiled binary - use execPath which is the actual binary path
    executable = process.execPath;
    args = ['daemon', '-f'];
  }

  if (configPath) {
    args.push('-c', configPath);
  }

  const child = spawn(executable, args, {
    detached: true,
    stdio: 'ignore',
    env: process.env
  });

  child.unref();

  // Wait for daemon to be ready
  const startTime = Date.now();
  while (Date.now() - startTime < DAEMON_START_TIMEOUT) {
    if (await isDaemonRunning()) {
      return;
    }
    await sleep(DAEMON_CHECK_INTERVAL);
  }

  throw new Error('Failed to start daemon: timeout');
}

export async function shutdownDaemon(): Promise<void> {
  const socketPath = getSocketPath();

  if (!existsSync(socketPath)) {
    return;
  }

  return new Promise((resolve, reject) => {
    const socket = connect(socketPath);

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

// === HTTP API Client ===

function getDaemonUrl(config: Config): string {
  const daemon = getDaemonState();
  const port = daemon?.port ?? config.daemon_port;
  return `http://localhost:${port}`;
}

export async function apiRequest<T>(
  config: Config,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${getDaemonUrl(config)}${config.base_path}${path}`;

  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error((data as { error?: string }).error ?? 'Request failed');
  }

  return data as T;
}

export async function getStatus(config: Config): Promise<StatusResponse> {
  return apiRequest<StatusResponse>(config, 'GET', '/api/status');
}

export async function getSessions(config: Config): Promise<SessionResponse[]> {
  return apiRequest<SessionResponse[]>(config, 'GET', '/api/sessions');
}

export async function startSession(
  config: Config,
  request: StartSessionRequest
): Promise<SessionResponse> {
  return apiRequest<SessionResponse>(config, 'POST', '/api/sessions', request);
}

export async function stopSession(config: Config, name: string): Promise<void> {
  await apiRequest<{ success: boolean }>(
    config,
    'DELETE',
    `/api/sessions/${encodeURIComponent(name)}`
  );
}

export async function requestShutdown(config: Config): Promise<void> {
  try {
    await apiRequest<{ success: boolean }>(config, 'POST', '/api/shutdown');
  } catch {
    // Server will shut down, so connection may be lost
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
