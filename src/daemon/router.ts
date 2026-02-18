import type { IncomingMessage, ServerResponse } from 'node:http';
import { normalizeBasePath } from '@/config/config.js';
import type { Config, SessionState } from '@/config/types.js';
import { createLogger } from '@/utils/logger.js';
import { handleApiRequest } from './api-handler.js';
import { proxyToSession } from './http-proxy.js';
import { generatePortalHtml } from './portal.js';
import { getIconPng, getIconSvg, getManifestJson, getServiceWorker } from './pwa.js';
import { sessionManager } from './session-manager.js';

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

  // Portal page
  if (url === basePath || url === `${basePath}/`) {
    if (method === 'GET') {
      log.debug('Serving portal page');
      servePortal(config, res);
      return;
    }
  }

  // Try to proxy to a session
  const session = findSessionForPath(config, url);
  if (session) {
    proxyToSession(req, res, session.port);
    return;
  }

  // Not found
  log.debug(`Not found: ${url}`);
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
}
