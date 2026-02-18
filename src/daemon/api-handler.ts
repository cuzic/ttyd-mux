import type { IncomingMessage, ServerResponse } from 'node:http';
import { getFullPath, normalizeBasePath } from '@/config/config.js';
import { getDaemonState } from '@/config/state.js';
import type { Config } from '@/config/types.js';
import { getErrorMessage } from '@/utils/errors.js';
import { isValidSessionName, sanitizeSessionName } from '@/utils/tmux-client.js';
import { generateJsonResponse } from './portal.js';
import {
  type StartSessionOptions,
  allocatePort,
  sessionManager,
  sessionNameFromDir
} from './session-manager.js';

export function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const body = generateJsonResponse(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

export function handleApiRequest(config: Config, req: IncomingMessage, res: ServerResponse): void {
  const basePath = normalizeBasePath(config.base_path);
  const url = req.url ?? '/';
  const path = url.slice(basePath.length);
  const method = req.method ?? 'GET';

  // GET /api/status
  if (path === '/api/status' && method === 'GET') {
    const daemon = getDaemonState();
    const sessions = sessionManager.listSessions().map((s) => ({
      ...s,
      fullPath: getFullPath(config, s.path)
    }));
    sendJson(res, 200, { daemon, sessions });
    return;
  }

  // GET /api/sessions
  if (path === '/api/sessions' && method === 'GET') {
    const sessions = sessionManager.listSessions().map((s) => ({
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
        const rawName = parsed.name ?? sessionNameFromDir(parsed.dir);
        // Sanitize session name to prevent command injection
        const name = isValidSessionName(rawName) ? rawName : sanitizeSessionName(rawName);
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

        const session = sessionManager.startSession(options);
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
      sessionManager.stopSession(name);
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
