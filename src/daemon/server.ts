import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'node:http';
import type { Socket } from 'node:net';
import httpProxy from 'http-proxy';
import WebSocket, { WebSocketServer } from 'ws';
import { getFullPath, normalizeBasePath } from '../config/config.js';
import { getDaemonState } from '../config/state.js';
import type { Config, SessionState } from '../config/types.js';
import { getErrorMessage } from '../utils/errors.js';
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
          fullPath
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
    console.log(`[Proxy] ${url} -> http://localhost:${session.port}`);
    proxy.web(req, res, { target: `http://localhost:${session.port}` });
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
      clientWs.on('close', (code, reason) => {
        backendWs.close(code, reason);
      });

      backendWs.on('close', (code, reason) => {
        clientWs.close(code, reason);
      });

      // Handle errors
      clientWs.on('error', () => backendWs.close());
      backendWs.on('error', () => clientWs.close());
    });
  });

  backendWs.on('error', (err) => {
    console.error(`[WebSocket] Connection error: ${err.message}`);
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
