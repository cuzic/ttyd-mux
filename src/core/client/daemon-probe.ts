/**
 * Daemon Probe
 *
 * HTTP-based daemon health check and command sending via Unix socket.
 */

import { getDaemonClientDeps } from './daemon-client-deps.js';

/**
 * Check if daemon is running by pinging the HTTP API over Unix socket
 */
export async function isDaemonRunning(): Promise<boolean> {
  const deps = getDaemonClientDeps();
  const socketPath = deps.stateStore.getApiSocketPath();

  if (!(await deps.socketClient.exists(socketPath))) {
    return false;
  }

  try {
    const res = await fetch('http://localhost/api/ping', {
      unix: socketPath,
      signal: AbortSignal.timeout(1000)
    } as RequestInit);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Send a command to the daemon and get response via HTTP API
 */
export async function sendCommand(command: string): Promise<string | null> {
  const deps = getDaemonClientDeps();
  const socketPath = deps.stateStore.getApiSocketPath();

  if (!(await deps.socketClient.exists(socketPath))) {
    return null;
  }

  try {
    const res = await fetch(`http://localhost/api/${command}`, {
      method: 'POST',
      unix: socketPath,
      signal: AbortSignal.timeout(5000)
    } as RequestInit);
    return await res.text();
  } catch {
    return null;
  }
}
