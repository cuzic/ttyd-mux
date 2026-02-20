/**
 * Tabs CSS Styles
 */

import type { TabsConfig } from '@/config/types.js';

/**
 * Generate CSS styles based on tabs configuration
 */
export function generateTabsStyles(config: TabsConfig): string {
  const { orientation, position, tab_width, tab_height } = config;
  const isVertical = orientation === 'vertical';
  const isRight = position === 'right';
  const isBottom = position === 'bottom';

  return `
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  height: 100%;
  overflow: hidden;
  background: #1a1a2e;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

#ttyd-tabs-container {
  display: flex;
  height: 100vh;
  width: 100vw;
  ${isVertical ? (isRight ? 'flex-direction: row-reverse;' : 'flex-direction: row;') : isBottom ? 'flex-direction: column-reverse;' : 'flex-direction: column;'}
}

/* Vertical sidebar styles */
#ttyd-tabs-sidebar {
  ${isVertical ? `width: ${tab_width}px;` : 'width: 100%;'}
  ${isVertical ? 'height: 100%;' : `height: ${tab_height}px;`}
  background: #1e1e1e;
  ${isVertical ? 'overflow-y: auto;' : 'overflow-x: auto;'}
  ${isVertical ? 'overflow-x: hidden;' : 'overflow-y: hidden;'}
  flex-shrink: 0;
  ${isVertical ? `border-${isRight ? 'left' : 'right'}: 2px solid #007acc;` : `border-${isBottom ? 'top' : 'bottom'}: 2px solid #007acc;`}
  ${isVertical ? '' : 'display: flex; white-space: nowrap;'}
}

/* Horizontal bar styles */
#ttyd-tabs-bar {
  display: flex;
  ${isVertical ? 'flex-direction: column;' : 'flex-direction: row;'}
  ${isVertical ? '' : 'height: 100%;'}
}

.ttyd-tab {
  ${isVertical ? 'padding: 12px 16px;' : 'padding: 8px 16px;'}
  ${isVertical ? 'border-bottom: 1px solid #333;' : 'border-right: 1px solid #333;'}
  cursor: pointer;
  color: #aaa;
  transition: background 0.15s, color 0.15s;
  ${isVertical ? '' : 'display: flex; align-items: center; white-space: nowrap;'}
}

.ttyd-tab:hover {
  background: #2a2a2a;
  color: #fff;
}

.ttyd-tab.active {
  background: #007acc;
  color: #fff;
  ${isVertical ? `border-${isRight ? 'left' : 'right'}: 3px solid #00d9ff;` : `border-${isBottom ? 'top' : 'bottom'}: 3px solid #00d9ff;`}
}

.ttyd-tab-name {
  font-weight: 600;
  font-size: 14px;
  ${isVertical ? 'display: block;' : ''}
}

.ttyd-tab-info {
  font-size: 11px;
  color: #888;
  ${isVertical ? 'display: block; margin-top: 4px;' : 'display: none;'}
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ttyd-tab.active .ttyd-tab-info {
  color: #ccc;
}

#ttyd-tabs-iframe-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #000;
}

.ttyd-session-iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: none;
}

.ttyd-session-iframe.hidden {
  display: none;
}

/* Loading indicator */
.ttyd-tab-loading {
  display: inline-block;
  width: 12px;
  height: 12px;
  margin-left: 8px;
  border: 2px solid #555;
  border-top-color: #007acc;
  border-radius: 50%;
  animation: ttyd-spin 1s linear infinite;
}

@keyframes ttyd-spin {
  to { transform: rotate(360deg); }
}

/* Empty state */
.ttyd-tabs-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #888;
  font-size: 16px;
  text-align: center;
  padding: 2rem;
}

/* Scrollbar styling */
#ttyd-tabs-sidebar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

#ttyd-tabs-sidebar::-webkit-scrollbar-track {
  background: #1e1e1e;
}

#ttyd-tabs-sidebar::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 3px;
}

#ttyd-tabs-sidebar::-webkit-scrollbar-thumb:hover {
  background: #555;
}

/* Mobile optimizations */
@media (max-width: 768px) {
  #ttyd-tabs-sidebar {
    ${isVertical ? 'width: 150px;' : ''}
  }

  .ttyd-tab {
    padding: 10px 12px;
  }

  .ttyd-tab-name {
    font-size: 13px;
  }
}

/* Very small screens - force horizontal tabs at bottom */
@media (max-width: 480px) {
  #ttyd-tabs-container {
    flex-direction: column-reverse !important;
  }

  #ttyd-tabs-sidebar {
    width: 100% !important;
    height: auto !important;
    max-height: 100px;
    overflow-x: auto !important;
    overflow-y: hidden !important;
    display: flex !important;
    border-top: 2px solid #007acc !important;
    border-right: none !important;
    border-left: none !important;
    border-bottom: none !important;
  }

  #ttyd-tabs-bar {
    flex-direction: row !important;
    height: 100%;
  }

  .ttyd-tab {
    border-bottom: none !important;
    border-right: 1px solid #333 !important;
    padding: 8px 12px;
    white-space: nowrap;
  }

  .ttyd-tab.active {
    border-top: 3px solid #00d9ff !important;
    border-right: 1px solid #333 !important;
  }

  .ttyd-tab-info {
    display: none !important;
  }
}
`;
}
