import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'node:http';
import type { Socket } from 'node:net';
import { gzipSync } from 'node:zlib';
import httpProxy from 'http-proxy';
import WebSocket, { WebSocketServer } from 'ws';
import { getFullPath, normalizeBasePath } from '../config/config.js';
import { getDaemonState } from '../config/state.js';
import type { Config, SessionState } from '../config/types.js';
import { getErrorMessage } from '../utils/errors.js';
import { injectImeHelper } from './ime-helper.js';
import { generateJsonResponse, generatePortalHtml } from './portal.js';
import {
  type StartSessionOptions,
  allocatePort,
  listSessions,
  sessionNameFromDir,
  startSession,
  stopSession
} from './session-manager.js';

// Create proxy server for HTTP only
const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  xfwd: true
});

// Handle proxy errors
proxy.on('error', (err, _req, res) => {
  console.error('Proxy error:', err.message);
  if (res && 'writeHead' in res && typeof res.writeHead === 'function') {
    const httpRes = res as ServerResponse;
    if (!httpRes.headersSent) {
      httpRes.writeHead(502, { 'Content-Type': 'text/plain' });
      httpRes.end('Bad Gateway');
    }
  }
});

// Handle selfHandleResponse for HTML injection
proxy.on('proxyRes', (proxyRes, req, res) => {
  const httpRes = res as ServerResponse;

  // Check if this is a self-handled HTML response
  const contentType = proxyRes.headers['content-type'] ?? '';
  if (!contentType.includes('text/html')) {
    // Not HTML, just pipe through
    httpRes.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);
    proxyRes.pipe(httpRes);
    return;
  }

  // Check if client supports gzip (stored in custom header before deletion)
  const acceptEncoding =
    (req as IncomingMessage & { originalAcceptEncoding?: string }).originalAcceptEncoding ?? '';
  const supportsGzip = acceptEncoding.includes('gzip');

  // Collect HTML body and inject IME helper
  const chunks: Buffer[] = [];
  proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk));
  proxyRes.on('end', () => {
    const originalHtml = Buffer.concat(chunks).toString('utf-8');
    const modifiedHtml = injectImeHelper(originalHtml);

    // Update headers
    const headers = { ...proxyRes.headers };
    delete headers['content-encoding'];

    if (supportsGzip) {
      // Compress with gzip
      const compressed = gzipSync(modifiedHtml);
      headers['content-encoding'] = 'gzip';
      headers['content-length'] = String(compressed.length);
      httpRes.writeHead(proxyRes.statusCode ?? 200, headers);
      httpRes.end(compressed);
    } else {
      // Send uncompressed
      headers['content-length'] = String(Buffer.byteLength(modifiedHtml));
      httpRes.writeHead(proxyRes.statusCode ?? 200, headers);
      httpRes.end(modifiedHtml);
    }
  });
});

export function findSessionForPath(config: Config, path: string): SessionState | null {
  const sessions = listSessions();
  const basePath = normalizeBasePath(config.base_path);

  for (const session of sessions) {
    const sessionFullPath = `${basePath}${session.path}`;
    if (path.startsWith(`${sessionFullPath}/`) || path === sessionFullPath) {
      return session;
    }
  }

  return null;
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const body = generateJsonResponse(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function handleApiRequest(config: Config, req: IncomingMessage, res: ServerResponse): void {
  const basePath = normalizeBasePath(config.base_path);
  const url = req.url ?? '/';
  const path = url.slice(basePath.length);
  const method = req.method ?? 'GET';

  // GET /api/status
  if (path === '/api/status' && method === 'GET') {
    const daemon = getDaemonState();
    const sessions = listSessions().map((s) => ({
      ...s,
      fullPath: getFullPath(config, s.path)
    }));
    sendJson(res, 200, { daemon, sessions });
    return;
  }

  // GET /api/sessions
  if (path === '/api/sessions' && method === 'GET') {
    const sessions = listSessions().map((s) => ({
      ...s,
      fullPath: getFullPath(config, s.path)
    }));
    sendJson(res, 200, sessions);
    return;
  }

  // POST /api/sessions
  if (path === '/api/sessions' && method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body) as {
          name?: string;
          dir: string;
          path?: string;
        };
        const name = parsed.name ?? sessionNameFromDir(parsed.dir);
        const sessionPath = parsed.path ?? `/${name}`;
        const port = allocatePort(config);
        const fullPath = getFullPath(config, sessionPath);

        const options: StartSessionOptions = {
          name,
          dir: parsed.dir,
          path: sessionPath,
          port,
          fullPath,
          tmuxMode: config.tmux_mode
        };

        const session = startSession(options);
        sendJson(res, 201, { ...session, fullPath });
      } catch (error) {
        sendJson(res, 400, { error: getErrorMessage(error) });
      }
    });
    return;
  }

  // DELETE /api/sessions/:name
  const deleteMatch = path.match(/^\/api\/sessions\/(.+)$/);
  if (deleteMatch?.[1] && method === 'DELETE') {
    const name = decodeURIComponent(deleteMatch[1]);
    try {
      stopSession(name);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 400, { error: getErrorMessage(error) });
    }
    return;
  }

  // POST /api/shutdown
  if (path === '/api/shutdown' && method === 'POST') {
    sendJson(res, 200, { success: true });
    setTimeout(() => {
      process.exit(0);
    }, 100);
    return;
  }

  // Not found
  sendJson(res, 404, { error: 'API endpoint not found' });
}

function handleRequest(config: Config, req: IncomingMessage, res: ServerResponse): void {
  const url = req.url ?? '/';
  const method = req.method ?? 'GET';
  const basePath = normalizeBasePath(config.base_path);

  // API routes
  if (url.startsWith(`${basePath}/api/`)) {
    handleApiRequest(config, req, res);
    return;
  }

  // Portal page
  if (url === basePath || url === `${basePath}/`) {
    if (method === 'GET') {
      const sessions = listSessions();
      const html = generatePortalHtml(config, sessions);
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': Buffer.byteLength(html)
      });
      res.end(html);
      return;
    }
  }

  // Try to proxy to a session
  const session = findSessionForPath(config, url);
  if (session) {
    const target = `http://localhost:${session.port}`;
    // Store original Accept-Encoding before deletion (for gzip re-compression)
    (req as IncomingMessage & { originalAcceptEncoding?: string }).originalAcceptEncoding = req
      .headers['accept-encoding'] as string | undefined;
    // Remove Accept-Encoding to get uncompressed response for HTML injection
    delete req.headers['accept-encoding'];
    // Always use selfHandleResponse to avoid conflicts with proxyRes handler
    proxy.web(req, res, { target, selfHandleResponse: true });
    return;
  }

  // Not found
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
}

// Create WebSocket server (noServer mode for manual upgrade handling)
const wss = new WebSocketServer({ noServer: true });

function handleUpgrade(config: Config, req: IncomingMessage, socket: Socket, head: Buffer): void {
  const url = req.url ?? '/';
  const session = findSessionForPath(config, url);
  if (!session) {
    socket.destroy();
    return;
  }

  // Connect to backend WebSocket
  const backendUrl = `ws://127.0.0.1:${session.port}${url}`;
  const protocol = req.headers['sec-websocket-protocol'];
  const backendWs = new WebSocket(
    backendUrl,
    protocol ? protocol.split(',').map((p) => p.trim()) : []
  );

  backendWs.on('open', () => {
    // Upgrade client connection once backend is ready
    wss.handleUpgrade(req, socket, head, (clientWs) => {
      let closed = false;

      const cleanup = (initiator: 'client' | 'backend', code?: number, reason?: Buffer) => {
        if (closed) return;
        closed = true;

        // Close the other side with proper code
        const closeCode = code ?? 1000;
        const closeReason = reason?.toString() ?? '';

        if (initiator === 'client') {
          if (backendWs.readyState === WebSocket.OPEN) {
            backendWs.close(closeCode, closeReason);
          } else {
            backendWs.terminate();
          }
        } else {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.close(closeCode, closeReason);
          } else {
            clientWs.terminate();
          }
        }
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
      clientWs.on('error', () => {
        clientWs.terminate();
        cleanup('client', 1006);
      });
      backendWs.on('error', () => {
        backendWs.terminate();
        cleanup('backend', 1006);
      });
    });
  });

  backendWs.on('error', (err) => {
    console.error(`[WebSocket] Connection error: ${err.message}`);
    backendWs.terminate();
    socket.destroy();
  });
}

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
