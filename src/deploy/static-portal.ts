import { getFullPath } from '@/config/config.js';
import type { Config, SessionState } from '@/config/types.js';

export function generateStaticPortalHtml(config: Config, sessions: SessionState[]): string {
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
  <title>ttyd-mux</title>
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      background: #1a1a2e;
      color: #eee;
      min-height: 100vh;
    }
    h1 {
      color: #00d9ff;
      margin-bottom: 0.5rem;
    }
    .subtitle {
      color: #888;
      margin-bottom: 2rem;
    }
    ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .session {
      margin: 0.5rem 0;
    }
    .session a {
      display: block;
      padding: 1rem;
      background: #16213e;
      border-radius: 8px;
      text-decoration: none;
      color: #eee;
      transition: background 0.2s, transform 0.1s;
    }
    .session a:hover {
      background: #1f3460;
      transform: translateX(4px);
    }
    .name {
      font-weight: 600;
      font-size: 1.1rem;
      color: #00d9ff;
    }
    .info {
      display: block;
      font-size: 0.85rem;
      color: #888;
      margin-top: 0.25rem;
    }
    .no-sessions {
      color: #888;
      padding: 2rem;
      text-align: center;
      background: #16213e;
      border-radius: 8px;
    }
    code {
      background: #0f0f23;
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      font-family: "SF Mono", Monaco, "Cascadia Code", monospace;
    }
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
  </div>
</body>
</html>
`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
