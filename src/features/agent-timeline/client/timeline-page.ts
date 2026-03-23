/**
 * Agent Timeline Page HTML Generator
 *
 * Generates the HTML page for the agent timeline view.
 * Uses external JS/CSS files (CSP-safe).
 */

import { escapeHtml } from '@/core/server/portal-utils.js';

/**
 * Generate timeline page HTML
 */
export function generateTimelineHtml(basePath: string, nonce: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Timeline - bunterm</title>
  <link rel="stylesheet" href="${escapeHtml(basePath)}/agents/timeline.css">
</head>
<body>
  <div class="timeline-header">
    <a href="${escapeHtml(basePath)}/" class="back-link">&larr; Portal</a>
    <h1>Agent Timeline</h1>
    <p class="subtitle">Real-time agent activity feed</p>
  </div>

  <div id="statusBar" class="status-bar">
    <span class="status-empty">Loading agents...</span>
    <span id="conflictBadge" class="conflict-badge" style="display:none;"></span>
  </div>

  <div class="view-toggle">
    <button class="view-toggle-btn active" data-view="timeline">Timeline</button>
    <button class="view-toggle-btn" data-view="kanban">Kanban</button>
  </div>

  <div id="filterBar" class="filter-bar"></div>

  <div id="waitingScreen" class="waiting-screen" style="display:none;">
    <div class="waiting-icon">
      <span class="waiting-dot"></span>
      <span class="waiting-dot"></span>
      <span class="waiting-dot"></span>
    </div>
    <p class="waiting-message">Agent Teams が開始されると、ここにリアルタイムで表示されます</p>
    <a href="${escapeHtml(basePath)}/" class="waiting-back-link">&larr; ターミナルに戻る</a>
  </div>

  <div id="connectionStatus" class="timeline-connection connecting">Connecting...</div>

  <div id="timelineContainer" class="timeline-container">
    <div id="emptyMessage" class="timeline-empty">No events yet. Waiting for agent activity...</div>
  </div>

  <div id="kanbanContainer" class="kanban-container" style="display:none;">
    <div id="kanbanCards" class="kanban-cards"></div>
    <div class="kanban-dots" id="kanbanDots"></div>
  </div>

  <div id="completionScreen" class="completion-screen" style="display:none;">
    <div class="completion-icon">&#10003;</div>
    <h2 class="completion-title">Agent Teams 完了</h2>
    <div id="completionSummary" class="completion-summary"></div>
    <div id="completionCountdown" class="completion-countdown"></div>
    <a id="completionReturnLink" href="${escapeHtml(basePath)}/" class="completion-return-link">&larr; ターミナルに戻る</a>
  </div>

  <script nonce="${escapeHtml(nonce)}">window.__TIMELINE_BASE_PATH__ = ${JSON.stringify(basePath)};</script>
  <script src="${escapeHtml(basePath)}/agents/timeline.js" nonce="${escapeHtml(nonce)}"></script>
</body>
</html>
`;
}
