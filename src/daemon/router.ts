import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
import { generateTabsHtml } from './tabs/index.js';

// Get the directory of this module for resolving dist path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache for toolbar.js content and ETag
let toolbarJsCache: string | null = null;
let toolbarJsEtag: string | null = null;

// Cache for tabs.js content and ETag
let tabsJsCache: string | null = null;
let tabsJsEtag: string | null = null;

// Regex for stripping trailing slashes
const TRAILING_SLASH_REGEX = /\/$/;

/**
 * Generate ETag from content using MD5 hash
 * @param content - Content to hash
 * @returns ETag string with quotes (e.g., '"abc123..."')
 */
export function generateEtag(content: string): string {
  return `"${createHash('md5').update(content).digest('hex')}"`;
}

/**
 * Reset toolbar.js cache (for testing)
 */
export function resetToolbarCache(): void {
  toolbarJsCache = null;
  toolbarJsEtag = null;
}

/**
 * Reset tabs.js cache (for testing)
 */
export function resetTabsCache(): void {
  tabsJsCache = null;
  tabsJsEtag = null;
}

// Share manager for validating share tokens
const shareManager = createShareManager({
  getShares: getAllShares,
  addShare: addShare,
  removeShare: removeShare,
  getShare: (token: string) => getShare(token)
});

/** Regex to extract share token from path (limited to 64 chars to prevent DoS) */
const SHARE_PATH_REGEX = /^\/share\/([a-f0-9]{1,64})(\/.*)?$/;

const log = createLogger('router');

/**
 * Set security headers on response
 */
export function setSecurityHeaders(res: ServerResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Content Security Policy - allow inline scripts for toolbar functionality
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; frame-src 'self'"
  );
  // Permissions Policy - disable unused browser features
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
}

/** Localhost addresses for origin validation */
const LOCALHOST_ADDRESSES = ['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost'];

/**
 * Check if a remote address is localhost
 */
function isLocalhostAddress(address: string | undefined): boolean {
  if (!address) {
    return false;
  }
  return LOCALHOST_ADDRESSES.some(
    (localhost) => address === localhost || address.endsWith(localhost)
  );
}

/**
 * Validate Origin header for state-changing requests (CSRF protection)
 * Returns true if the request is allowed, false otherwise
 */
export function validateOrigin(req: IncomingMessage, config: Config): boolean {
  const method = req.method ?? 'GET';

  // Only validate state-changing methods
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return true;
  }

  const origin = req.headers['origin'];
  const host = req.headers['host'];

  // If no Origin header, check Referer as fallback
  if (!origin) {
    const referer = req.headers['referer'];
    if (!referer) {
      // No origin info - only allow for localhost connections (e.g., curl, Postman)
      // This prevents CSRF attacks while allowing local API tools
      const remoteAddress = req.socket?.remoteAddress;
      if (isLocalhostAddress(remoteAddress)) {
        return true;
      }
      // Deny requests from remote hosts without Origin/Referer
      log.warn(`Blocked request without Origin/Referer from: ${remoteAddress}`);
      return false;
    }
    try {
      const refererUrl = new URL(referer);
      return refererUrl.host === host;
    } catch {
      return false;
    }
  }

  // Validate Origin matches expected hosts
  try {
    const originUrl = new URL(origin);

    // Allow localhost and configured hostname
    const allowedHosts = [host, 'localhost', '127.0.0.1', '::1', config.hostname].filter(Boolean);

    // Check if origin host matches any allowed host (ignoring port)
    const originHost = originUrl.hostname;
    return allowedHosts.some((allowed) => {
      if (!allowed) {
        return false;
      }
      // Extract hostname from host:port format
      const allowedHost = allowed.split(':')[0];
      return originHost === allowedHost;
    });
  } catch {
    return false;
  }
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
 * Load toolbar.js from dist directory (cached)
 * Returns { content, etag }
 */
function loadToolbarJs(): { content: string; etag: string } {
  if (toolbarJsCache !== null && toolbarJsEtag !== null) {
    return { content: toolbarJsCache, etag: toolbarJsEtag };
  }

  try {
    // Load from dist directory (relative to compiled output)
    const distPath = join(__dirname, '../../dist/toolbar.js');
    toolbarJsCache = readFileSync(distPath, 'utf-8');
    log.debug('Loaded toolbar.js from dist');
  } catch {
    // Fallback: bundle not available
    log.warn('toolbar.js not found in dist, returning placeholder');
    toolbarJsCache =
      '// toolbar.js not built - run: bun run build:toolbar\nconsole.warn("[Toolbar] Bundle not found");';
  }

  // Calculate ETag from content hash
  toolbarJsEtag = generateEtag(toolbarJsCache);

  return { content: toolbarJsCache, etag: toolbarJsEtag };
}

/**
 * Serve toolbar JavaScript (static file from dist)
 * Supports ETag-based conditional requests for cache revalidation
 */
function serveToolbarJs(req: IncomingMessage, res: ServerResponse): void {
  const { content, etag } = loadToolbarJs();

  // Check If-None-Match header for conditional request
  const ifNoneMatch = req.headers['if-none-match'];
  if (ifNoneMatch === etag) {
    // Content hasn't changed, return 304 Not Modified
    res.writeHead(304, {
      ETag: etag,
      'Cache-Control': 'public, max-age=0, must-revalidate'
    });
    res.end();
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'application/javascript',
    'Content-Length': Buffer.byteLength(content),
    ETag: etag,
    'Cache-Control': 'public, max-age=0, must-revalidate'
  });
  res.end(content);
}

/**
 * Load tabs.js from dist directory (cached)
 * Returns { content, etag }
 */
function loadTabsJs(): { content: string; etag: string } {
  if (tabsJsCache !== null && tabsJsEtag !== null) {
    return { content: tabsJsCache, etag: tabsJsEtag };
  }

  try {
    // Load from dist directory (relative to compiled output)
    const distPath = join(__dirname, '../../dist/tabs.js');
    tabsJsCache = readFileSync(distPath, 'utf-8');
    log.debug('Loaded tabs.js from dist');
  } catch {
    // Fallback: bundle not available
    log.warn('tabs.js not found in dist, returning placeholder');
    tabsJsCache =
      '// tabs.js not built - run: bun run build:tabs\nconsole.warn("[Tabs] Bundle not found");';
  }

  // Calculate ETag from content hash
  tabsJsEtag = generateEtag(tabsJsCache);

  return { content: tabsJsCache, etag: tabsJsEtag };
}

/**
 * Serve tabs JavaScript (static file from dist)
 * Supports ETag-based conditional requests for cache revalidation
 */
function serveTabsJs(req: IncomingMessage, res: ServerResponse): void {
  const { content, etag } = loadTabsJs();

  // Check If-None-Match header for conditional request
  const ifNoneMatch = req.headers['if-none-match'];
  if (ifNoneMatch === etag) {
    // Content hasn't changed, return 304 Not Modified
    res.writeHead(304, {
      ETag: etag,
      'Cache-Control': 'public, max-age=0, must-revalidate'
    });
    res.end();
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'application/javascript',
    'Content-Length': Buffer.byteLength(content),
    ETag: etag,
    'Cache-Control': 'public, max-age=0, must-revalidate'
  });
  res.end(content);
}

/**
 * Serve tabs HTML page
 */
function serveTabs(config: Config, res: ServerResponse, sessionName: string | null): void {
  const sessions = sessionManager.listSessions();
  const html = generateTabsHtml(config, sessions, sessionName);
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html)
  });
  res.end(html);
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
    // Validate origin for state-changing requests (CSRF protection)
    if (!validateOrigin(req, config)) {
      log.warn(`Blocked request with invalid origin: ${method} ${url}`);
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid origin' }));
      return;
    }
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

  // Toolbar JavaScript (static file)
  if (url === `${basePath}/toolbar.js`) {
    serveToolbarJs(req, res);
    return;
  }

  // Tabs JavaScript (static file)
  if (url === `${basePath}/tabs.js`) {
    serveTabsJs(req, res);
    return;
  }

  // Tabs view: /ttyd-mux/tabs/ or /ttyd-mux/tabs/{session}
  if (url.startsWith(`${basePath}/tabs`)) {
    const tabsPath = `${basePath}/tabs`;
    if (url === tabsPath || url === `${tabsPath}/`) {
      // /tabs/ - show tabs view with first/last session
      if (method === 'GET') {
        log.debug('Serving tabs page');
        serveTabs(config, res, null);
        return;
      }
    } else if (url.startsWith(`${tabsPath}/`)) {
      // /tabs/{session} - show tabs view with specific session
      const sessionPart = url.slice(tabsPath.length + 1).replace(TRAILING_SLASH_REGEX, '');
      const sessionName = decodeURIComponent(sessionPart);
      if (method === 'GET' && sessionName) {
        log.debug(`Serving tabs page for session: ${sessionName}`);
        serveTabs(config, res, sessionName);
        return;
      }
    }
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
    proxyToSession(req, res, session.port, basePath, config.toolbar);
    return;
  }

  // Try to proxy to a session
  const session = findSessionForPath(config, url);
  if (session) {
    proxyToSession(req, res, session.port, basePath, config.toolbar);
    return;
  }

  // Not found
  log.debug(`Not found: ${url}`);
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
}
