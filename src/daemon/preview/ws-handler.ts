/**
 * Preview WebSocket Handler
 *
 * Handles WebSocket connections for live preview file watching.
 */

import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import { createLogger } from '@/utils/logger.js';
import type WebSocket from 'ws';
import { WebSocketServer } from 'ws';
import { sessionManager } from '../session-manager.js';
import type { FileChangeEvent, PreviewClientMessage, PreviewServerMessage } from './types.js';
import { onFileChange, unwatchAllForClient, unwatchFile, watchFile } from './watcher.js';

const log = createLogger('preview-ws');

/** WebSocket server for preview connections */
const wss = new WebSocketServer({ noServer: true });

/** Map of client WebSocket to session name */
const clientSessions = new Map<WebSocket, string>();

/** Initialize change event forwarding */
let changeListenerInitialized = false;

function initializeChangeListener(): void {
  if (changeListenerInitialized) return;
  changeListenerInitialized = true;

  onFileChange((event: FileChangeEvent) => {
    // Find all clients watching this session/file and notify them
    for (const client of wss.clients) {
      const ws = client as WebSocket;
      if (ws.readyState === 1) {
        // WebSocket.OPEN
        const message: PreviewServerMessage = event;
        ws.send(JSON.stringify(message));
      }
    }
  });
}

/**
 * Handle a WebSocket message from client
 */
function handleMessage(ws: WebSocket, data: string): void {
  try {
    const message = JSON.parse(data) as PreviewClientMessage;

    // Find session directory
    const session = sessionManager.listSessions().find((s) => s.name === message.session);
    if (!session) {
      log.warn(`Session not found: ${message.session}`);
      return;
    }

    switch (message.action) {
      case 'watch':
        clientSessions.set(ws, message.session);
        const success = watchFile(session.dir, message.path, message.session, ws);
        if (success) {
          log.debug(`Client subscribed to: ${message.session}/${message.path}`);
        }
        break;

      case 'unwatch':
        unwatchFile(session.dir, message.path, ws);
        log.debug(`Client unsubscribed from: ${message.session}/${message.path}`);
        break;

      default:
        log.warn(`Unknown action: ${(message as { action: string }).action}`);
    }
  } catch (err) {
    log.error('Failed to parse message:', err);
  }
}

/**
 * Handle a new WebSocket connection
 */
function handleConnection(ws: WebSocket): void {
  log.debug('Preview WebSocket client connected');

  ws.on('message', (data) => {
    handleMessage(ws, data.toString());
  });

  ws.on('close', () => {
    log.debug('Preview WebSocket client disconnected');
    unwatchAllForClient(ws);
    clientSessions.delete(ws);
  });

  ws.on('error', (err) => {
    log.error('WebSocket error:', err);
    unwatchAllForClient(ws);
    clientSessions.delete(ws);
  });
}

/**
 * Handle WebSocket upgrade for preview endpoint
 */
export function handlePreviewUpgrade(req: IncomingMessage, socket: Socket, head: Buffer): void {
  initializeChangeListener();

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
    handleConnection(ws);
  });
}

/**
 * Get preview WebSocket statistics
 */
export function getPreviewWsStats(): { connectedClients: number } {
  return {
    connectedClients: wss.clients.size
  };
}

/**
 * Cleanup preview WebSocket server
 */
export function cleanupPreviewWs(): void {
  for (const client of wss.clients) {
    client.close(1000, 'Server shutdown');
  }
  clientSessions.clear();
  log.info('Preview WebSocket server cleaned up');
}
