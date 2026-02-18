import { getFullPath, normalizeBasePath } from '@/config/config.js';
import type { Config, SessionState } from '@/config/types.js';
import {
  escapeHtml,
  generatePwaHead,
  generateSwRegistration,
  portalStyles
} from './portal-utils.js';

/**
 * Generate auto-reload script for portal page
 * Reloads the page when the tab becomes visible to refresh session list
 */
function generateAutoReloadScript(): string {
  return `
  <script>
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) {
        location.reload();
      }
    });
  </script>`;
}

export function generatePortalHtml(config: Config, sessions: SessionState[]): string {
  const basePath = normalizeBasePath(config.base_path);
  const sessionItems = sessions
    .map((session) => {
      const fullPath = getFullPath(config, session.path);
      return `      <li class="session">
        <a href="${fullPath}/" target="_blank">
          <span class="name">${escapeHtml(session.name)}</span>
          <span class="info">:${session.port} - ${escapeHtml(session.dir)}</span>
        </a>
      </li>`;
    })
    .join('\n');

  const noSessions =
    sessions.length === 0
      ? '<p class="no-sessions">No active sessions. Use <code>ttyd-mux up</code> to start one.</p>'
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ttyd-mux</title>${generatePwaHead(basePath)}
  <style>${portalStyles}
    .refresh {
      margin-top: 2rem;
      text-align: center;
    }
    .refresh a {
      color: #00d9ff;
      text-decoration: none;
    }
    .refresh a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <h1>ttyd-mux</h1>
  <p class="subtitle">Active Terminal Sessions</p>
  <ul>
${sessionItems}
  </ul>
  ${noSessions}
  <div class="refresh">
    <a href="javascript:location.reload()">Refresh</a>
  </div>${generateSwRegistration(basePath)}${generateAutoReloadScript()}
</body>
</html>
`;
}

export function generateJsonResponse(data: unknown): string {
  return JSON.stringify(data, null, 2);
}
