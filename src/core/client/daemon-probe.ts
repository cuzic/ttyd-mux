/**
 * Daemon Probe
 *
 * Socket-based daemon communication: ping and command sending.
 */

import { getDaemonClientDeps } from './daemon-client-deps.js';

/**
 * Check if daemon is running by pinging the socket
 */
export async function isDaemonRunning(): Promise<boolean> {
  const deps = getDaemonClientDeps();
  const socketPath = deps.stateStore.getSocketPath();

  if (!deps.socketClient.exists(socketPath)) {
    return false;
  }

  return new Promise((resolve) => {
    const socket = deps.socketClient.connect(socketPath);

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

/**
 * Send a command to the daemon and get response
 */
export async function sendCommand(command: string): Promise<string | null> {
  const deps = getDaemonClientDeps();
  const socketPath = deps.stateStore.getSocketPath();

  if (!deps.socketClient.exists(socketPath)) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const socket = deps.socketClient.connect(socketPath);

    socket.on('connect', () => {
      socket.write(command);
    });

    socket.on('data', (data) => {
      const response = data.toString().trim();
      socket.end();
      resolve(response);
    });

    socket.on('error', (err) => {
      reject(err);
    });

    socket.setTimeout(5000, () => {
      socket.destroy();
      reject(new Error('Command timeout'));
    });
  });
}
