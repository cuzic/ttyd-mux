/**
 * Tabs HTML Template
 */

import { getFullPath, normalizeBasePath } from '@/config/config.js';
import type { Config, SessionState } from '@/config/types.js';
import { escapeHtml, generatePwaHead, generateSwRegistration } from '../portal-utils.js';
import { generateTabsStyles } from './styles.js';

/**
 * Generate tabs page HTML
 */
export function generateTabsHtml(
  config: Config,
  sessions: SessionState[],
  currentSession: string | null
): string {
  const basePath = normalizeBasePath(config.base_path);
  const tabsConfig = config.tabs;

  // Determine initial session
  const initialSession = currentSession
    ? (sessions.find((s) => s.name === currentSession)?.name ?? sessions[0]?.name)
    : sessions[0]?.name;

  // Generate tab items HTML
  const tabItems = sessions
    .map((session) => {
      const isActive = session.name === initialSession;
      const fullPath = getFullPath(config, session.path);
      return `
      <div class="ttyd-tab${isActive ? ' active' : ''}"
           data-session="${escapeHtml(session.name)}"
           data-path="${escapeHtml(fullPath)}">
        <span class="ttyd-tab-name">${escapeHtml(session.name)}</span>
        ${tabsConfig.show_session_info ? `<span class="ttyd-tab-info">${escapeHtml(session.dir)}</span>` : ''}
      </div>`;
    })
    .join('\n');

  // Generate config script
  const clientConfig = {
    basePath,
    tabs: tabsConfig,
    initialSession,
    sessions: sessions.map((s) => ({
      name: s.name,
      path: getFullPath(config, s.path),
      dir: s.dir
    }))
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>ttyd-mux tabs</title>${generatePwaHead(basePath)}
  <style>${generateTabsStyles(tabsConfig)}</style>
</head>
<body>
  <div id="ttyd-tabs-container">
    <div id="ttyd-tabs-sidebar">
      <div id="ttyd-tabs-bar">
${tabItems}
      </div>
    </div>
    <div id="ttyd-tabs-iframe-container">
      ${sessions.length === 0 ? '<div class="ttyd-tabs-empty">No active sessions.<br>Use <code>ttyd-mux up</code> to start one.</div>' : ''}
    </div>
  </div>
  <script>window.__TABS_CONFIG__ = ${JSON.stringify(clientConfig)};</script>
  <script src="${basePath}/tabs.js"></script>${generateSwRegistration(basePath)}
</body>
</html>
`;
}
