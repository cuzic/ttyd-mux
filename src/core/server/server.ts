/**
 * Native Terminal Server
 *
 * Bun.serve based HTTP/WebSocket server for native terminal mode.
 * This server handles both HTTP requests and WebSocket connections
 * for native terminal sessions.
 */

import type { Server as BunServer, ServerWebSocket } from 'bun';
import { normalizeBasePath } from '@/core/config/config.js';
import { getAllPushSubscriptions, getStateDir } from '@/core/config/state.js';
import type { Config } from '@/core/config/types.js';
import { SlidingWindowRateLimiter } from '@/core/server/auth/rate-limiter.js';
import { setTimelineService } from '@/core/server/http/routes/api/agents-routes.js';
import { NativeSessionManager } from '@/core/server/session-manager.js';
import {
  type AuthenticatedWebSocketData,
  createNativeTerminalWebSocketHandlers,
  isNativeTerminalWebSocketPath
} from '@/core/server/ws-handler.js';
import { AgentTimelineService } from '@/features/agent-timeline/server/timeline-service.js';
import { createNotificationSender } from '@/features/notifications/server/sender.js';
import { loadOrGenerateVapidKeys } from '@/features/notifications/server/vapid.js';
import { createLogger } from '@/utils/logger.js';

const log = createLogger('native-server');

/**
 * Extract session name from WebSocket path
 * e.g., /bunterm/my-session/ws -> my-session
 */
function extractSessionNameFromWsPath(pathname: string, basePath: string): string | null {
  const prefix = `${basePath}/`;
  if (!pathname.startsWith(prefix)) {
    return null;
  }

  const rest = pathname.slice(prefix.length);
  if (!rest.endsWith('/ws')) {
    return null;
  }

  return rest.slice(0, -3); // Remove '/ws'
}

export interface NativeTerminalServerOptions {
  config: Config;
  getConfig: () => Config;
}

export interface NativeTerminalServer {
  server: BunServer<AuthenticatedWebSocketData>;
  sessionManager: NativeSessionManager;
  stop: () => Promise<void>;
}

/** Return 429 Too Many Requests with Retry-After header */
function tooManyRequests(): Response {
  return new Response(JSON.stringify({ error: 'Too Many Requests' }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': '60'
    }
  });
}

/**
 * Create a native terminal server using Bun.serve
 */
export function createNativeTerminalServer(
  options: NativeTerminalServerOptions
): NativeTerminalServer {
  const { config, getConfig } = options;
  const sessionManager = new NativeSessionManager(config);
  const basePath = normalizeBasePath(config.base_path);

  // Initialize push notification sender for agent error events
  const stateDir = getStateDir();
  const vapidKeys = loadOrGenerateVapidKeys(stateDir);
  const contactEmail = config.notifications?.contact_email ?? 'webmaster@localhost';
  const notificationSender = createNotificationSender(vapidKeys, contactEmail, {
    getSubscriptions: () => getAllPushSubscriptions(),
    getSubscriptionsForSession: (sessionName) =>
      getAllPushSubscriptions().filter((s) => !s.sessionName || s.sessionName === sessionName),
    removeSubscription: (_id) => {
      // Removal handled by notifications-routes
    }
  });

  // Initialize agent timeline service for SSE streaming
  const timelineService = new AgentTimelineService({
    sessionManager,
    onErrorEvent: (event) => {
      notificationSender
        .sendNotification({
          pattern: {
            regex: '',
            message: `[bunterm] Agent Error: ${event.agentName}`
          },
          matchedText: event.summary,
          sessionName: event.agentName,
          timestamp: event.timestamp
        })
        .catch((error) => {
          log.error(`Failed to send error notification: ${String(error)}`);
        });
    }
  });
  setTimelineService(timelineService);

  const wsHandlers = createNativeTerminalWebSocketHandlers({
    sessionManager,
    basePath
  });

  // Rate limiters for API endpoints (per-category, IP-based)
  const apiSessionCreateLimiter = new SlidingWindowRateLimiter({
    windowMs: 60_000,
    maxRequests: 5 // Session creation: 5 req/min per IP
  });
  const apiFileUploadLimiter = new SlidingWindowRateLimiter({
    windowMs: 60_000,
    maxRequests: 20 // File upload: 20 req/min per IP
  });
  const apiAiLimiter = new SlidingWindowRateLimiter({
    windowMs: 60_000,
    maxRequests: 10 // AI endpoints: 10 req/min per IP
  });
  const apiGetLimiter = new SlidingWindowRateLimiter({
    windowMs: 60_000,
    maxRequests: 60 // GET endpoints: 60 req/min per IP
  });
  const apiMutateLimiter = new SlidingWindowRateLimiter({
    windowMs: 60_000,
    maxRequests: 30 // POST/PUT/DELETE endpoints: 30 req/min per IP
  });

  // Periodic cleanup of expired rate limit entries (every 5 minutes)
  const rateLimitCleanupInterval = setInterval(() => {
    apiSessionCreateLimiter.cleanup();
    apiFileUploadLimiter.cleanup();
    apiAiLimiter.cleanup();
    apiGetLimiter.cleanup();
    apiMutateLimiter.cleanup();
  }, 5 * 60_000);

  /**
   * Check API rate limit by endpoint category.
   * Returns true if the request should be rejected (rate limited).
   */
  function checkApiRateLimit(apiPath: string, method: string, clientIp: string): boolean {
    // Session creation (POST /api/sessions) — 5 req/min
    if (apiPath === '/sessions' && method === 'POST') {
      return !apiSessionCreateLimiter.isAllowed(clientIp);
    }

    // File upload (POST /api/files/upload, /api/clipboard-image) — 20 req/min
    if ((apiPath === '/files/upload' || apiPath === '/clipboard-image') && method === 'POST') {
      return !apiFileUploadLimiter.isAllowed(clientIp);
    }

    // AI endpoints (POST /api/ai/*) — 10 req/min
    if (apiPath.startsWith('/ai/') && method === 'POST') {
      return !apiAiLimiter.isAllowed(clientIp);
    }

    // General GET — 60 req/min
    if (method === 'GET') {
      return !apiGetLimiter.isAllowed(clientIp);
    }

    // General mutation (POST/PUT/DELETE) — 30 req/min
    if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
      return !apiMutateLimiter.isAllowed(clientIp);
    }

    return false;
  }

  const server = Bun.serve<AuthenticatedWebSocketData>({
    port: config.daemon_port,
    hostname: config.listen_addresses[0] || '127.0.0.1',

    async fetch(req, server) {
      const url = new URL(req.url);
      const pathname = url.pathname;
      const currentConfig = getConfig();

      log.debug(`Request: ${req.method} ${pathname}`);

      // Handle WebSocket upgrade for native terminal sessions
      if (isNativeTerminalWebSocketPath(pathname, basePath)) {
        // Extract session name from path
        const sessionName = extractSessionNameFromWsPath(pathname, basePath);
        if (!sessionName) {
          return new Response('Invalid WebSocket path', { status: 400 });
        }

        // Create session if it doesn't exist
        if (!sessionManager.hasSession(sessionName)) {
          try {
            await sessionManager.createSession({
              name: sessionName,
              dir: process.cwd(),
              path: `${basePath}/${sessionName}`
            });
            log.info(`Created session on WebSocket connect: ${sessionName}`);
          } catch (error) {
            log.error(`Failed to create session ${sessionName}: ${error}`);
            return new Response('Failed to create session', { status: 500 });
          }
        }

        // Upgrade to WebSocket
        const upgraded = server.upgrade(req, {
          data: { sessionName, authenticated: false }
        });

        if (upgraded) {
          return undefined; // Upgrade successful
        }

        return new Response('WebSocket upgrade failed', { status: 500 });
      }

      // Rate limit: API endpoints (per-category)
      if (pathname.startsWith(`${basePath}/api/`)) {
        const clientIp = server.requestIP(req)?.address ?? 'unknown';
        const apiPath = pathname.slice(`${basePath}/api`.length);
        if (checkApiRateLimit(apiPath, req.method, clientIp)) {
          log.debug(`Rate limited API ${req.method} ${apiPath} from ${clientIp}`);
          return tooManyRequests();
        }
      }

      // Import router functions dynamically to avoid circular dependency
      const { handleHttpRequest } = await import('@/core/server/http-handler.js');
      return handleHttpRequest(req, currentConfig, sessionManager, basePath);
    },

    websocket: {
      open(ws: ServerWebSocket<AuthenticatedWebSocketData>) {
        wsHandlers.websocket.open(ws);
      },
      message(ws: ServerWebSocket<AuthenticatedWebSocketData>, message: string | Buffer) {
        wsHandlers.websocket.message(ws, message);
      },
      close(ws: ServerWebSocket<AuthenticatedWebSocketData>) {
        wsHandlers.websocket.close(ws);
      }
    }
  });

  log.info(`Native terminal server started on ${config.listen_addresses[0]}:${config.daemon_port}`);

  return {
    server,
    sessionManager,
    async stop() {
      clearInterval(rateLimitCleanupInterval);
      timelineService.dispose();
      apiSessionCreateLimiter.dispose();
      apiFileUploadLimiter.dispose();
      apiAiLimiter.dispose();
      apiGetLimiter.dispose();
      apiMutateLimiter.dispose();
      await sessionManager.stopAll();
      server.stop();
    }
  };
}
