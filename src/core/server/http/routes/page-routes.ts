/**
 * Page Routes
 *
 * Handles HTML page rendering: portal, terminal sessions, share pages, agent timeline.
 */

import { randomBytes } from 'node:crypto';
import { addShare, getAllShares, getShare, removeShare } from '@/core/config/state.js';
import type { Config } from '@/core/config/types.js';
import { generateNativeTerminalHtml } from '@/core/server/html-template.js';
import { extractSessionFromPagePath } from '@/core/server/http/path-utils.js';
import { htmlResponse, securityHeaders } from '@/core/server/http/utils.js';
import { generatePortalHtml } from '@/core/server/portal.js';
import type { NativeSessionManager } from '@/core/server/session-manager.js';
import { isNativeTerminalHtmlPath } from '@/core/server/ws-handler.js';
import { generateTimelineHtml } from '@/features/agent-timeline/client/timeline-page.js';
import { createShareManager } from '@/features/share/server/share-manager.js';
import { createLogger } from '@/utils/logger.js';

const log = createLogger('page-routes');

// Create ShareManager with file-system backed store
const shareManager = createShareManager({
  getShares: getAllShares,
  addShare: addShare,
  removeShare: removeShare,
  getShare: (token: string) => getShare(token)
});

export { shareManager };

export interface PageRoutesConfig {
  basePath: string;
  config: Config;
  sessionManager: NativeSessionManager;
}

/**
 * Handle page routes
 * Returns Response if handled, null if not a page route
 */
export async function handlePageRoutes(
  req: Request,
  pathname: string,
  routeConfig: PageRoutesConfig
): Promise<Response | null> {
  const { basePath, config, sessionManager } = routeConfig;
  const method = req.method;
  const sentryEnabled = config.sentry?.enabled ?? false;

  // Portal page
  if (pathname === basePath || pathname === `${basePath}/`) {
    if (method === 'GET') {
      const sessions = sessionManager.listSessions().map((s) => ({
        name: s.name,
        pid: s.pid,
        port: 0,
        path: `/${s.name}`,
        dir: s.dir,
        started_at: s.startedAt
      }));
      const html = generatePortalHtml(config, sessions);
      return htmlResponse(html, { sentryEnabled });
    }
  }

  // Session HTML page (native terminal)
  if (isNativeTerminalHtmlPath(pathname, basePath)) {
    const sessionName = extractSessionFromPagePath(pathname, basePath);
    if (sessionName) {
      let session = sessionManager.getSession(sessionName);

      // If session doesn't exist, try to create it
      if (!session) {
        try {
          session = await sessionManager.createSession({
            name: sessionName,
            dir: process.cwd(),
            path: `${basePath}/${sessionName}`
          });
          log.info(`Created session on demand: ${sessionName}`);
        } catch (error) {
          log.error(`Failed to create session ${sessionName}: ${error}`);
          return new Response('Failed to create session', {
            status: 500,
            headers: { ...securityHeaders(sentryEnabled), 'Content-Type': 'text/plain' }
          });
        }
      }

      const html = generateNativeTerminalHtml({
        sessionName,
        basePath,
        sessionPath: `${basePath}/${sessionName}`,
        config
      });
      return htmlResponse(html, { sentryEnabled });
    }
  }

  // Agent timeline page
  if (pathname === `${basePath}/agents` || pathname === `${basePath}/agents/`) {
    if (method === 'GET') {
      const nonce = randomBytes(16).toString('base64');
      const html = generateTimelineHtml(basePath, nonce);
      return htmlResponse(html, { sentryEnabled });
    }
  }

  // Share page: /share/:token
  const shareMatch = pathname.match(new RegExp(`^${basePath}/share/([^/]+)$`));
  if (shareMatch?.[1]) {
    const token = decodeURIComponent(shareMatch[1]);
    const share = shareManager.validateShare(token);

    if (!share) {
      return new Response('Share link not found or expired', {
        status: 404,
        headers: { ...securityHeaders(sentryEnabled), 'Content-Type': 'text/plain' }
      });
    }

    const sessionName = share.sessionName;

    if (!sessionManager.hasSession(sessionName)) {
      return new Response('Session not found', {
        status: 404,
        headers: { ...securityHeaders(sentryEnabled), 'Content-Type': 'text/plain' }
      });
    }

    const html = generateNativeTerminalHtml({
      sessionName,
      basePath,
      sessionPath: `${basePath}/${sessionName}`,
      config,
      isShared: true
    });
    return htmlResponse(html, { sentryEnabled });
  }

  return null;
}
