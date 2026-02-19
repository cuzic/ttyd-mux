/**
 * Session Tabs Module
 *
 * Provides a tabbed interface for switching between multiple ttyd sessions.
 * Each session is loaded in an iframe for instant switching with state preservation.
 */

import { DEFAULT_TABS_CONFIG, type TabsConfig } from '@/config/types.js';

export { generateTabsHtml } from './template.js';
export { generateTabsStyles } from './styles.js';
export * from './config.js';

// Re-export type and default config
export { DEFAULT_TABS_CONFIG };
export type { TabsConfig };
