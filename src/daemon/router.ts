import type { IncomingMessage, ServerResponse } from 'node:http';
import { normalizeBasePath } from '@/config/config.js';
import { addShare, getAllShares, getShare, removeShare } from '@/config/state.js';
import type { Config, SessionState } from '@/config/types.js';
import { createLogger } from '@/utils/logger.js';
import { handleApiRequest } from './api-handler.js';
import { proxyToSession } from './http-proxy.js';
import { generatePortalHtml } from './portal.js';
import { getIconPng, getIconSvg, getManifestJson, getServiceWorker } from './pwa.js';
import { sessionManager } from './session-manager.js';
import { createShareManager } from './share-manager.js';
import { getToolbarJs } from './toolbar/index.js';

// Share manager for validating share tokens
const shareManager = createShareManager({
  getShares: getAllShares,
  addShare: addShare,
  removeShare: removeShare,
  getShare: (token: string) => getShare(token)
});

/** Regex to extract share token from path */
const SHARE_PATH_REGEX = /^\/share\/([a-f0-9]+)(\/.*)?$/;

const log = createLogger('router');

/**
 * Set security headers on response
 */
export function setSecurityHeaders(res: ServerResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

/**
 * Find session that matches the given path
 */
export function findSessionForPath(config: Config, path: string): SessionState | null {
  const sessions = sessionManager.listSessions();
  const basePath = normalizeBasePath(config.base_path);

  for (const session of sessions) {
    const sessionFullPath = `${basePath}${session.path}`;
    if (path.startsWith(`${sessionFullPath}/`) || path === sessionFullPath) {
      return session;
    }
  }

  return null;
}

/**
 * Serve portal HTML page
 */
function servePortal(config: Config, res: ServerResponse): void {
  const sessions = sessionManager.listSessions();
  const html = generatePortalHtml(config, sessions);
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html)
  });
  res.end(html);
}

/**
 * Serve PWA manifest.json
 */
function servePwaManifest(res: ServerResponse, basePath: string): void {
  const json = getManifestJson(basePath);
  res.writeHead(200, {
    'Content-Type': 'application/manifest+json',
    'Content-Length': Buffer.byteLength(json)
  });
  res.end(json);
}

/**
 * Serve PWA Service Worker
 */
function servePwaServiceWorker(res: ServerResponse): void {
  const script = getServiceWorker();
  res.writeHead(200, {
    'Content-Type': 'application/javascript',
    'Content-Length': Buffer.byteLength(script),
    'Service-Worker-Allowed': '/'
  });
  res.end(script);
}

/**
 * Serve PWA SVG icon
 */
function servePwaIconSvg(res: ServerResponse): void {
  const svg = getIconSvg();
  res.writeHead(200, {
    'Content-Type': 'image/svg+xml',
    'Content-Length': Buffer.byteLength(svg),
    'Cache-Control': 'public, max-age=86400'
  });
  res.end(svg);
}

/**
 * Serve PWA PNG icon
 */
function servePwaIconPng(res: ServerResponse, size: 192 | 512): void {
  const png = getIconPng(size);
  res.writeHead(200, {
    'Content-Type': 'image/png',
    'Content-Length': png.length,
    'Cache-Control': 'public, max-age=86400'
  });
  res.end(png);
}

/**
 * Serve toolbar JavaScript
 */
function serveToolbarJs(config: Config, res: ServerResponse): void {
  const script = getToolbarJs(config.toolbar);
  res.writeHead(200, {
    'Content-Type': 'application/javascript',
    'Content-Length': Buffer.byteLength(script),
    'Cache-Control': 'public, max-age=3600'
  });
  res.end(script);
}

/**
 * Handle incoming HTTP request
 */
export function handleRequest(config: Config, req: IncomingMessage, res: ServerResponse): void {
  const url = req.url ?? '/';
  const method = req.method ?? 'GET';
  const basePath = normalizeBasePath(config.base_path);

  // Apply security headers to all responses
  setSecurityHeaders(res);

  log.debug(`Request: ${method} ${url}`);

  // API routes
  if (url.startsWith(`${basePath}/api/`)) {
    handleApiRequest(config, req, res);
    return;
  }

  // PWA routes
  if (url === `${basePath}/manifest.json`) {
    servePwaManifest(res, basePath);
    return;
  }
  if (url === `${basePath}/sw.js`) {
    servePwaServiceWorker(res);
    return;
  }
  if (url === `${basePath}/icon.svg`) {
    servePwaIconSvg(res);
    return;
  }
  if (url === `${basePath}/icon-192.png`) {
    servePwaIconPng(res, 192);
    return;
  }
  if (url === `${basePath}/icon-512.png`) {
    servePwaIconPng(res, 512);
    return;
  }

  // Toolbar JavaScript
  if (url === `${basePath}/toolbar.js`) {
    serveToolbarJs(config, res);
    return;
  }

  // Portal page
  if (url === basePath || url === `${basePath}/`) {
    if (method === 'GET') {
      log.debug('Serving portal page');
      servePortal(config, res);
      return;
    }
  }

  // Share links: /ttyd-mux/share/:token
  const sharePath = url.slice(basePath.length);
  const shareMatch = sharePath.match(SHARE_PATH_REGEX);
  if (shareMatch?.[1]) {
    const token = shareMatch[1];
    const share = shareManager.validateShare(token);

    if (!share) {
      log.debug(`Share not found or expired: ${token}`);
      res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html>
<html>
<head><title>Share Link Expired</title></head>
<body style="font-family: sans-serif; padding: 2rem; text-align: center;">
  <h1>Share Link Expired</h1>
  <p>This share link has expired or been revoked.</p>
</body>
</html>`);
      return;
    }

    // Find the session
    const session = sessionManager.listSessions().find((s) => s.name === share.sessionName);
    if (!session) {
      log.debug(`Session not found for share: ${share.sessionName}`);
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html>
<html>
<head><title>Session Not Found</title></head>
<body style="font-family: sans-serif; padding: 2rem; text-align: center;">
  <h1>Session Not Found</h1>
  <p>The shared session is no longer running.</p>
</body>
</html>`);
      return;
    }

    // Proxy to the session in read-only mode
    // Set a header to indicate read-only mode for WebSocket proxy
    req.headers['x-ttyd-mux-readonly'] = 'true';
    proxyToSession(req, res, session.port, basePath);
    return;
  }

  // Try to proxy to a session
  const session = findSessionForPath(config, url);
  if (session) {
    proxyToSession(req, res, session.port, basePath);
    return;
  }

  // Not found
  log.debug(`Not found: ${url}`);
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
}
