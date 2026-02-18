import { getFullPath, normalizeBasePath } from '@/config/config.js';
import type { Config, SessionState } from '@/config/types.js';
import {
  escapeHtml,
  generatePwaHead,
  generateSwRegistration,
  portalStyles
} from '@/daemon/portal-utils.js';

export function generateStaticPortalHtml(config: Config, sessions: SessionState[]): string {
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
      ? '<p class="no-sessions">No active sessions. Use <code>ttyd-mux up</code> to start one, then run <code>ttyd-mux deploy</code> again.</p>'
      : '';

  const generatedAt = new Date().toISOString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ttyd-mux</title>${generatePwaHead(basePath)}
  <style>${portalStyles}
    .footer {
      margin-top: 2rem;
      text-align: center;
      color: #555;
      font-size: 0.8rem;
    }
    .mode-badge {
      display: inline-block;
      background: #2d4a22;
      color: #7cb342;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      margin-left: 0.5rem;
    }
  </style>
</head>
<body>
  <h1>ttyd-mux <span class="mode-badge">static mode</span></h1>
  <p class="subtitle">Terminal Sessions</p>
  <ul>
${sessionItems}
  </ul>
  ${noSessions}
  <div class="footer">
    <p>Static portal generated at ${generatedAt}</p>
    <p>Run <code>ttyd-mux deploy</code> to update after session changes</p>
  </div>${generateSwRegistration(basePath)}
</body>
</html>
`;
}
