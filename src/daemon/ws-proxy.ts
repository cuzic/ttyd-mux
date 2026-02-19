import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import type { Config, SessionState } from '@/config/types.js';
import { createLogger } from '@/utils/logger.js';
import WebSocket, { WebSocketServer } from 'ws';
import type { NotificationService } from './notification/index.js';
import { findSessionForPath } from './router.js';

const log = createLogger('websocket');

// Create WebSocket server (noServer mode for manual upgrade handling)
const wss = new WebSocketServer({ noServer: true });

// Global notification service reference (set by daemon)
let globalNotificationService: NotificationService | null = null;

/**
 * Set the notification service for output monitoring
 */
export function setNotificationService(service: NotificationService | null): void {
  globalNotificationService = service;
}

/**
 * Get the notification service
 */
export function getNotificationService(): NotificationService | null {
  return globalNotificationService;
}

/**
 * Gracefully close a WebSocket connection
 */
export function closeWebSocket(ws: WebSocket, code: number, reason: string): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.close(code, reason);
  } else {
    ws.terminate();
  }
}

/**
 * Options for WebSocket forwarding
 */
export interface ForwardingOptions {
  /** If true, block input messages from client to backend (read-only mode) */
  readOnly?: boolean;
  /** Session name for notification tracking */
  sessionName?: string;
  /** Notification service for output monitoring */
  notificationService?: NotificationService;
}

/**
 * Check if data is a ttyd input message (command byte '0')
 * ttyd protocol: first byte is command type, '0' = input
 */
function isInputMessage(data: Buffer | ArrayBuffer | Buffer[]): boolean {
  if (Buffer.isBuffer(data) && data.length > 0) {
    // ttyd input command is '0' (0x30)
    return data[0] === 0x30;
  }
  if (data instanceof ArrayBuffer && data.byteLength > 0) {
    return new Uint8Array(data)[0] === 0x30;
  }
  return false;
}

/**
 * Check if data is a ttyd output message (command byte '1')
 * ttyd protocol: first byte is command type, '1' = output
 */
function isOutputMessage(data: Buffer | ArrayBuffer | Buffer[]): boolean {
  if (Buffer.isBuffer(data) && data.length > 1) {
    // ttyd output command is '1' (0x31)
    return data[0] === 0x31;
  }
  if (data instanceof ArrayBuffer && data.byteLength > 1) {
    return new Uint8Array(data)[0] === 0x31;
  }
  return false;
}

/**
 * Extract text from ttyd output message
 */
function extractOutputText(data: Buffer): string {
  // Skip first byte (command type) and decode the rest as UTF-8
  return data.subarray(1).toString('utf-8');
}

// Output buffer for accumulating text before matching
const outputBuffers = new Map<string, string>();
const OUTPUT_BUFFER_MAX_LENGTH = 4096;

/**
 * Process terminal output for pattern matching
 */
function processOutput(
  sessionName: string,
  text: string,
  notificationService: NotificationService
): void {
  // First, check raw text for control characters (bell, etc.)
  // This catches patterns that don't fall on line boundaries
  notificationService.processOutput(sessionName, text);

  // Also accumulate output for line-based pattern matching
  let buffer = outputBuffers.get(sessionName) ?? '';
  buffer += text;

  // Keep buffer size manageable
  if (buffer.length > OUTPUT_BUFFER_MAX_LENGTH) {
    buffer = buffer.slice(-OUTPUT_BUFFER_MAX_LENGTH);
  }

  // Check for patterns in complete lines
  const lines = buffer.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i]?.trim();
    if (line) {
      notificationService.processOutput(sessionName, line);
    }
  }

  // Keep only the last incomplete line in buffer
  const lastLine = lines[lines.length - 1] ?? '';
  outputBuffers.set(sessionName, lastLine);
}

/**
 * Setup bidirectional WebSocket forwarding
 */
export function setupWebSocketForwarding(
  clientWs: WebSocket,
  backendWs: WebSocket,
  options: ForwardingOptions = {}
): void {
  let closed = false;
  const { readOnly = false, sessionName, notificationService } = options;

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
    // In read-only mode, block input messages
    if (readOnly && isBinary && isInputMessage(data as Buffer)) {
      log.debug('Blocked input message in read-only mode');
      return;
    }
    if (backendWs.readyState === WebSocket.OPEN) {
      backendWs.send(data, { binary: isBinary });
    }
  });

  backendWs.on('message', (data, isBinary) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(data, { binary: isBinary });
    }

    // Process output for notification pattern matching
    if (sessionName && notificationService?.isEnabled() && isBinary && isOutputMessage(data as Buffer)) {
      try {
        const text = extractOutputText(data as Buffer);
        if (text) {
          processOutput(sessionName, text, notificationService);
        }
      } catch {
        // Ignore output processing errors
      }
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
  head: Buffer,
  options: ForwardingOptions = {}
): void {
  const backendUrl = `ws://127.0.0.1:${session.port}${url}`;
  log.debug(`Connecting to backend WebSocket: ${backendUrl}${options.readOnly ? ' (read-only)' : ''}`);

  const backendWs = new WebSocket(
    backendUrl,
    protocol ? protocol.split(',').map((p) => p.trim()) : []
  );

  backendWs.on('open', () => {
    log.debug(`Backend WebSocket connected: ${backendUrl}`);
    // Upgrade client connection once backend is ready
    wss.handleUpgrade(req, socket, head, (clientWs) => {
      setupWebSocketForwarding(clientWs, backendWs, options);
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

  // Check for read-only header (set by router for share links)
  const readOnly = req.headers['x-ttyd-mux-readonly'] === 'true';

  const session = findSessionForPath(config, url);
  if (!session) {
    log.warn(`WebSocket upgrade rejected - no session for: ${url}`);
    socket.destroy();
    return;
  }

  const protocol = req.headers['sec-websocket-protocol'];
  connectToBackend(session, url, protocol, req, socket, head, {
    readOnly,
    sessionName: session.name,
    notificationService: globalNotificationService ?? undefined
  });
}
