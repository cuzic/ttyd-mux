/**
 * Terminal Toolbar Module
 *
 * Provides a toolbar for ttyd sessions with:
 * - IME input support for Japanese
 * - Font size zoom controls
 * - Copy/paste functionality
 * - Touch gesture support
 * - Modifier key buttons (Ctrl, Alt, Shift)
 */

import { DEFAULT_TOOLBAR_CONFIG, type ToolbarConfig } from '@/config/types.js';
import {
  AUTO_RUN_KEY,
  CLIPBOARD_HISTORY_KEY,
  ONBOARDING_SHOWN_KEY,
  SNIPPETS_KEY,
  STORAGE_KEY
} from './config.js';
import { toolbarStyles } from './styles.js';
import { onboardingHtml, toolbarHtml } from './template.js';

// Re-export config constants (localStorage keys only)
export { AUTO_RUN_KEY, CLIPBOARD_HISTORY_KEY, ONBOARDING_SHOWN_KEY, SNIPPETS_KEY, STORAGE_KEY };

// Re-export for direct access
export { onboardingHtml, toolbarHtml, toolbarStyles };

// Re-export type and default config
export { DEFAULT_TOOLBAR_CONFIG };
export type { ToolbarConfig };

/**
 * Inject toolbar into HTML response
 *
 * Injects:
 * - CSS styles (inline for FOUC avoidance)
 * - HTML structure
 * - Onboarding tooltip (hidden by default)
 * - Config as global variable
 * - Script tag referencing external toolbar.js (static file)
 *
 * @param html - Original HTML content
 * @param basePath - Base path for the ttyd-mux routes (e.g., "/ttyd-mux")
 * @param config - Toolbar configuration from config.yaml
 * @returns Modified HTML with toolbar injected
 */
export function injectToolbar(
  html: string,
  basePath: string,
  config: ToolbarConfig = DEFAULT_TOOLBAR_CONFIG
): string {
  // Merge basePath into config for client-side use
  const clientConfig = { ...config, base_path: basePath };
  const configScript = `<script>window.__TOOLBAR_CONFIG__ = ${JSON.stringify(clientConfig)};</script>`;
  const injection = `
<style>${toolbarStyles}</style>
${toolbarHtml}
${onboardingHtml.replace('id="ttyd-toolbar-onboarding"', 'id="ttyd-toolbar-onboarding" style="display:none"')}
${configScript}
<script src="${basePath}/toolbar.js"></script>
`;
  return html.replace('</body>', `${injection}</body>`);
}
