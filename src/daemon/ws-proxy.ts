import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import type { Config, SessionState } from '@/config/types.js';
import { createLogger } from '@/utils/logger.js';
import WebSocket, { WebSocketServer } from 'ws';
import { findSessionForPath } from './router.js';

const log = createLogger('websocket');

// Create WebSocket server (noServer mode for manual upgrade handling)
const wss = new WebSocketServer({ noServer: true });

/**
 * Gracefully close a WebSocket connection
 */
function closeWebSocket(ws: WebSocket, code: number, reason: string): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.close(code, reason);
  } else {
    ws.terminate();
  }
}

/**
 * Setup bidirectional WebSocket forwarding
 */
function setupWebSocketForwarding(clientWs: WebSocket, backendWs: WebSocket): void {
  let closed = false;

  const cleanup = (initiator: 'client' | 'backend', code?: number, reason?: Buffer) => {
    if (closed) {
      return;
    }
    closed = true;

    log.debug(`WebSocket cleanup initiated by ${initiator}, code=${code}`);
    const closeCode = code ?? 1000;
    const closeReason = reason?.toString() ?? '';
    const wsToClose = initiator === 'client' ? backendWs : clientWs;
    closeWebSocket(wsToClose, closeCode, closeReason);
  };

  // Forward messages bidirectionally
  clientWs.on('message', (data, isBinary) => {
    if (backendWs.readyState === WebSocket.OPEN) {
      backendWs.send(data, { binary: isBinary });
    }
  });

  backendWs.on('message', (data, isBinary) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(data, { binary: isBinary });
    }
  });

  // Handle close events
  clientWs.on('close', (code, reason) => cleanup('client', code, reason));
  backendWs.on('close', (code, reason) => cleanup('backend', code, reason));

  // Handle errors - terminate to ensure cleanup
  clientWs.on('error', (err) => {
    log.error(`Client WebSocket error: ${err.message}`);
    clientWs.terminate();
    cleanup('client', 1006);
  });
  backendWs.on('error', (err) => {
    log.error(`Backend WebSocket error: ${err.message}`);
    backendWs.terminate();
    cleanup('backend', 1006);
  });
}

/**
 * Connect to backend WebSocket and setup forwarding
 */
function connectToBackend(
  session: SessionState,
  url: string,
  protocol: string | undefined,
  req: IncomingMessage,
  socket: Socket,
  head: Buffer
): void {
  const backendUrl = `ws://127.0.0.1:${session.port}${url}`;
  log.debug(`Connecting to backend WebSocket: ${backendUrl}`);

  const backendWs = new WebSocket(
    backendUrl,
    protocol ? protocol.split(',').map((p) => p.trim()) : []
  );

  backendWs.on('open', () => {
    log.debug(`Backend WebSocket connected: ${backendUrl}`);
    // Upgrade client connection once backend is ready
    wss.handleUpgrade(req, socket, head, (clientWs) => {
      setupWebSocketForwarding(clientWs, backendWs);
    });
  });

  backendWs.on('error', (err) => {
    log.error(`Backend WebSocket connection failed: ${backendUrl} - ${err.message}`);
    backendWs.terminate();
    socket.destroy();
  });
}

/**
 * Handle WebSocket upgrade request
 */
export function handleUpgrade(
  config: Config,
  req: IncomingMessage,
  socket: Socket,
  head: Buffer
): void {
  const url = req.url ?? '/';
  log.debug(`WebSocket upgrade request: ${url}`);

  const session = findSessionForPath(config, url);
  if (!session) {
    log.warn(`WebSocket upgrade rejected - no session for: ${url}`);
    socket.destroy();
    return;
  }

  const protocol = req.headers['sec-websocket-protocol'];
  connectToBackend(session, url, protocol, req, socket, head);
}
