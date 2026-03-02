/**
 * Native Terminal WebSocket Handler
 *
 * Handles WebSocket connections for native terminal sessions using Bun's
 * built-in WebSocket server.
 *
 * Security features:
 * - Origin validation for CSWSH protection
 * - Sec-WebSocket-Protocol token authentication
 */

import type { ServerWebSocket } from 'bun';
import type { NativeSessionManager } from './session-manager.js';
import type { NativeTerminalWebSocket, NativeTerminalWebSocketData } from './types.js';
import { createErrorMessage, serializeServerMessage } from './types.js';
import {
  DEFAULT_SECURITY_CONFIG,
  type SecurityConfig,
  createBearerProtocol,
  extractBearerToken,
  getTokenGenerator,
  validateOrigin
} from './ws/index.js';

export interface NativeTerminalWebSocketHandlerOptions {
  /** Session manager instance */
  sessionManager: NativeSessionManager;
  /** Base path for WebSocket endpoints (e.g., /ttyd-mux) */
  basePath: string;
  /** Security configuration for Origin validation */
  securityConfig?: SecurityConfig;
  /** Enable token authentication (default: false for backward compatibility) */
  enableTokenAuth?: boolean;
}

// Extended WebSocket data with authentication info
export interface AuthenticatedWebSocketData extends NativeTerminalWebSocketData {
  /** User ID from token (if authenticated) */
  userId?: string;
  /** Whether connection is authenticated via token */
  authenticated: boolean;
}

/**
 * Create WebSocket handlers for native terminal connections
 */
// Using 'any' for Server type due to Bun's generic requirements
// biome-ignore lint/suspicious/noExplicitAny: Bun Server type varies by context
type BunServer = any;

export function createNativeTerminalWebSocketHandlers(
  options: NativeTerminalWebSocketHandlerOptions
): {
  upgrade: (
    req: Request,
    server: BunServer
  ) => Response | undefined | Promise<Response | undefined>;
  websocket: {
    open: (ws: ServerWebSocket<AuthenticatedWebSocketData>) => void;
    message: (ws: ServerWebSocket<AuthenticatedWebSocketData>, message: string | Buffer) => void;
    close: (ws: ServerWebSocket<AuthenticatedWebSocketData>) => void;
  };
} {
  const { sessionManager, basePath, enableTokenAuth = false } = options;
  const securityConfig = options.securityConfig ?? DEFAULT_SECURITY_CONFIG;

  /**
   * Extract session name from WebSocket path
   * e.g., /ttyd-mux/my-session/ws -> my-session
   */
  function extractSessionName(pathname: string): string | null {
    const prefix = basePath + '/';
    if (!pathname.startsWith(prefix)) {
      return null;
    }

    const rest = pathname.slice(prefix.length);
    if (!rest.endsWith('/ws')) {
      return null;
    }

    return rest.slice(0, -3); // Remove '/ws'
  }

  return {
    /**
     * Upgrade HTTP request to WebSocket for native terminal
     */
    async upgrade(req: Request, server: BunServer): Promise<Response | undefined> {
      const url = new URL(req.url);
      const sessionName = extractSessionName(url.pathname);

      if (!sessionName) {
        return undefined; // Not a native terminal WebSocket request
      }

      // === Origin Validation ===
      const originResult = validateOrigin(req, securityConfig);
      if (!originResult.allowed) {
        console.warn(
          `[NativeTerminalWS] Origin validation failed: ${originResult.reason} for ${req.headers.get('Origin')}`
        );
        return new Response(`Forbidden: ${originResult.reason}`, { status: 403 });
      }

      // === Token Authentication (optional) ===
      let userId: string | undefined;
      let authenticated = false;
      let responseProtocol: string | undefined;

      if (enableTokenAuth) {
        const protocols = req.headers.get('Sec-WebSocket-Protocol');
        const token = extractBearerToken(protocols);

        if (!token) {
          return new Response('Unauthorized: Token required', { status: 401 });
        }

        const tokenGenerator = getTokenGenerator();
        const validation = await tokenGenerator.validate(token);

        if (!validation.valid) {
          console.warn(`[NativeTerminalWS] Token validation failed: ${validation.error}`);
          return new Response(`Unauthorized: ${validation.error}`, { status: 401 });
        }

        // Verify token is for this session
        if (validation.session?.sid !== sessionName) {
          return new Response('Unauthorized: Token session mismatch', { status: 401 });
        }

        userId = validation.session.uid;
        authenticated = true;
        responseProtocol = createBearerProtocol(token);
      }

      // Check if session exists
      const session = sessionManager.getSession(sessionName);
      if (!session) {
        return new Response('Session not found', { status: 404 });
      }

      // Upgrade to WebSocket
      const upgradeOptions: {
        data: AuthenticatedWebSocketData;
        headers?: Record<string, string>;
      } = {
        data: {
          sessionName,
          userId,
          authenticated
        }
      };

      // Echo back the Sec-WebSocket-Protocol if token auth is enabled
      if (responseProtocol) {
        upgradeOptions.headers = {
          'Sec-WebSocket-Protocol': responseProtocol
        };
      }

      const upgraded = server.upgrade(req, upgradeOptions);

      if (upgraded) {
        return undefined; // Upgrade successful
      }

      return new Response('WebSocket upgrade failed', { status: 500 });
    },

    websocket: {
      /**
       * Handle WebSocket connection opened
       */
      open(ws: ServerWebSocket<AuthenticatedWebSocketData>): void {
        const { sessionName, authenticated, userId } = ws.data;
        const session = sessionManager.getSession(sessionName);

        if (!session) {
          ws.send(serializeServerMessage(createErrorMessage('Session not found')));
          ws.close(1008, 'Session not found');
          return;
        }

        // Cast to base type for session manager compatibility
        session.addClient(ws as unknown as NativeTerminalWebSocket);

        const authInfo = authenticated
          ? ` (authenticated${userId ? `, user: ${userId}` : ''})`
          : '';
        console.log(`[NativeTerminalWS] Client connected to session: ${sessionName}${authInfo}`);
      },

      /**
       * Handle incoming WebSocket message
       */
      message(ws: ServerWebSocket<AuthenticatedWebSocketData>, message: string | Buffer): void {
        const { sessionName } = ws.data;
        const session = sessionManager.getSession(sessionName);

        if (!session) {
          ws.send(serializeServerMessage(createErrorMessage('Session not found')));
          return;
        }

        // Convert Buffer to string if needed
        const messageStr = typeof message === 'string' ? message : message.toString('utf-8');

        session.handleMessage(ws as unknown as NativeTerminalWebSocket, messageStr);
      },

      /**
       * Handle WebSocket connection closed
       */
      close(ws: ServerWebSocket<AuthenticatedWebSocketData>): void {
        const { sessionName } = ws.data;
        sessionManager.handleWebSocketClose(sessionName, ws as unknown as NativeTerminalWebSocket);
        console.log(`[NativeTerminalWS] Client disconnected from session: ${sessionName}`);
      }
    }
  };
}

/**
 * Check if a request path matches a native terminal WebSocket endpoint
 */
export function isNativeTerminalWebSocketPath(pathname: string, basePath: string): boolean {
  const prefix = basePath + '/';
  if (!pathname.startsWith(prefix)) {
    return false;
  }

  const rest = pathname.slice(prefix.length);
  return rest.endsWith('/ws');
}

/**
 * Check if a request path matches a native terminal HTML endpoint
 */
export function isNativeTerminalHtmlPath(pathname: string, basePath: string): boolean {
  const prefix = basePath + '/';
  if (!pathname.startsWith(prefix)) {
    return false;
  }

  const rest = pathname.slice(prefix.length);
  // Match /ttyd-mux/session-name/ or /ttyd-mux/session-name
  // But not /ttyd-mux/session-name/ws or /ttyd-mux/static-file.js
  if (rest.endsWith('/ws')) {
    return false;
  }
  if (rest.includes('.')) {
    // Has file extension, likely a static file
    return false;
  }

  // Should be a session name (possibly with trailing slash)
  const sessionName = rest.replace(/\/$/, '');
  return sessionName.length > 0 && !sessionName.includes('/');
}
