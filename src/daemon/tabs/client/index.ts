/**
 * Tabs Client Entry Point
 *
 * Initializes the session tabs feature.
 */

import { SessionTabManager } from './SessionTabManager.js';
import type { TabsClientConfig } from './types.js';

// Initialize when DOM is ready
function init(): void {
  const config = window.__TABS_CONFIG__ as TabsClientConfig | undefined;

  if (!config) {
    return;
  }

  try {
    const manager = new SessionTabManager(config);
    manager.initialize();
  } catch (_error) {
    // Initialization error - silently ignore
  }
}

// Run init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
