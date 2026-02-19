import type { IncomingMessage, ServerResponse } from 'node:http';
import { gzipSync } from 'node:zlib';
import { DEFAULT_TOOLBAR_CONFIG, type ToolbarConfig } from '@/config/types.js';
import { createLogger } from '@/utils/logger.js';
import httpProxy from 'http-proxy';
import { injectToolbar } from './toolbar/index.js';

const log = createLogger('proxy');

/**
 * Build clean headers object (filter out undefined values and encoding headers)
 */
export function buildCleanHeaders(
  headers: Record<string, string | string[] | undefined>
): Record<string, string | string[]> {
  const cleanHeaders: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined && key !== 'content-encoding' && key !== 'transfer-encoding') {
      cleanHeaders[key] = value;
    }
  }
  return cleanHeaders;
}

/**
 * Transform HTML response with toolbar injection and optional gzip compression
 */
export function transformHtmlResponse(
  originalHtml: string,
  supportsGzip: boolean,
  basePath: string,
  toolbarConfig: ToolbarConfig = DEFAULT_TOOLBAR_CONFIG
): { body: Buffer; headers: Record<string, string> } {
  const modifiedHtml = injectToolbar(originalHtml, basePath, toolbarConfig);
  const headers: Record<string, string> = {};

  if (supportsGzip) {
    const compressed = gzipSync(modifiedHtml);
    headers['content-encoding'] = 'gzip';
    headers['content-length'] = String(compressed.length);
    return { body: compressed, headers };
  }
  headers['content-length'] = String(Buffer.byteLength(modifiedHtml));
  return { body: Buffer.from(modifiedHtml), headers };
}

/**
 * Check if content type is HTML
 */
export function isHtmlContentType(contentType: string): boolean {
  return contentType.includes('text/html');
}

/**
 * Check if client supports gzip encoding
 */
export function supportsGzipEncoding(acceptEncoding: string): boolean {
  return acceptEncoding.includes('gzip');
}

// Create proxy server for HTTP only
export const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  xfwd: true
});

// Handle proxy errors
proxy.on('error', (err, req, res) => {
  const url = (req as IncomingMessage).url ?? 'unknown';
  log.error(`Proxy error for ${url}: ${err.message}`);
  if (res && 'writeHead' in res && typeof res.writeHead === 'function') {
    const httpRes = res as ServerResponse;
    if (!httpRes.headersSent) {
      httpRes.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' });
      httpRes.end(`<!DOCTYPE html>
<html><head><title>502 Bad Gateway</title></head>
<body style="font-family:sans-serif;padding:2em;">
<h1>502 Bad Gateway</h1>
<p>The ttyd session may have been stopped or is not responding.</p>
<p>Try <a href="javascript:location.reload()">reloading</a> or check session status with: <code>ttyd-mux status</code></p>
</body></html>`);
    }
  }
});

// Handle selfHandleResponse for HTML injection
proxy.on('proxyRes', (proxyRes, req, res) => {
  const httpRes = res as ServerResponse;

  // Check if this is a self-handled HTML response
  const contentType = proxyRes.headers['content-type'] ?? '';
  if (!isHtmlContentType(contentType)) {
    // Not HTML, just pipe through
    httpRes.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);
    proxyRes.pipe(httpRes);
    return;
  }

  // Check if client supports gzip (stored in custom property before deletion)
  type ExtendedRequest = IncomingMessage & {
    originalAcceptEncoding?: string;
    toolbarBasePath?: string;
    toolbarConfig?: ToolbarConfig;
  };
  const extReq = req as ExtendedRequest;
  const acceptEncoding = extReq.originalAcceptEncoding ?? '';
  const supportsGzip = supportsGzipEncoding(acceptEncoding);
  const basePath = extReq.toolbarBasePath ?? '/ttyd-mux';
  const toolbarConfig = extReq.toolbarConfig ?? DEFAULT_TOOLBAR_CONFIG;

  // Collect HTML body and inject toolbar
  const chunks: Buffer[] = [];
  proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk));
  proxyRes.on('end', () => {
    const originalHtml = Buffer.concat(chunks).toString('utf-8');
    const { body, headers: transformHeaders } = transformHtmlResponse(
      originalHtml,
      supportsGzip,
      basePath,
      toolbarConfig
    );

    // Build clean headers object
    const headers = buildCleanHeaders(proxyRes.headers);
    Object.assign(headers, transformHeaders);

    httpRes.writeHead(proxyRes.statusCode ?? 200, headers);
    httpRes.end(body);
  });
});

/**
 * Proxy HTTP request to session backend
 */
export function proxyToSession(
  req: IncomingMessage,
  res: ServerResponse,
  port: number,
  basePath: string,
  toolbarConfig: ToolbarConfig = DEFAULT_TOOLBAR_CONFIG
): void {
  const target = `http://localhost:${port}`;
  log.debug(`Proxying ${req.url} to ${target}`);

  // Store original Accept-Encoding, basePath, and config for use in proxyRes handler
  type ExtendedRequest = IncomingMessage & {
    originalAcceptEncoding?: string;
    toolbarBasePath?: string;
    toolbarConfig?: ToolbarConfig;
  };
  const extReq = req as ExtendedRequest;
  extReq.originalAcceptEncoding = req.headers['accept-encoding'] as string | undefined;
  extReq.toolbarBasePath = basePath;
  extReq.toolbarConfig = toolbarConfig;

  // Request uncompressed response for HTML injection (identity = no encoding)
  req.headers['accept-encoding'] = 'identity';

  // Always use selfHandleResponse to avoid conflicts with proxyRes handler
  proxy.web(req, res, { target, selfHandleResponse: true });
}
