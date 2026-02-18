import { type Server, createServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import type { Config } from '@/config/types.js';
import { handleRequest } from './router.js';
import { handleUpgrade } from './ws-proxy.js';

// Dynamic import to avoid circular dependency and allow fallback
let getConfigFunc: (() => Config) | null = null;

/**
 * Set the config getter function (called by daemon on startup)
 */
export function setConfigGetter(getter: () => Config): void {
  getConfigFunc = getter;
}

/**
 * Create the daemon HTTP server with WebSocket support
 *
 * Note: When ConfigManager is initialized (via setConfigGetter), the server
 * uses the dynamic config for each request to support hot-reloading.
 * Otherwise, it falls back to the initialConfig (for testing).
 *
 * @param initialConfig - Initial config (used as fallback when ConfigManager not initialized)
 */
export function createDaemonServer(initialConfig: Config): Server {
  const server = createServer((req, res) => {
    // Use dynamic config if available, otherwise fall back to initialConfig
    const config = getConfigFunc ? getConfigFunc() : initialConfig;
    handleRequest(config, req, res);
  });

  // Handle WebSocket upgrades
  server.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) => {
    // Use dynamic config if available, otherwise fall back to initialConfig
    const config = getConfigFunc ? getConfigFunc() : initialConfig;
    handleUpgrade(config, req, socket, head);
  });

  return server;
}
