import { type Server, createServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import type { Config } from '@/config/types.js';
import { handleRequest } from './router.js';
import { handleUpgrade } from './ws-proxy.js';

/**
 * Create the daemon HTTP server with WebSocket support
 */
export function createDaemonServer(config: Config): Server {
  const server = createServer((req, res) => {
    handleRequest(config, req, res);
  });

  // Handle WebSocket upgrades
  server.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) => {
    handleUpgrade(config, req, socket, head);
  });

  return server;
}
