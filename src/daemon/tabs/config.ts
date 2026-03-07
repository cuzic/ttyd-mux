/**
 * Tabs Configuration Constants
 */

/** LocalStorage key prefix for tabs state */
export const STORAGE_PREFIX = 'bunterm-tabs-';

/** LocalStorage key for last selected session */
export const LAST_SESSION_KEY = `${STORAGE_PREFIX}last-session`;

/** CSS class names */
export const CSS_CLASSES = {
  CONTAINER: 'bunterm-tabs-container',
  SIDEBAR: 'bunterm-tabs-sidebar',
  BAR: 'bunterm-tabs-bar',
  TAB: 'bunterm-tab',
  TAB_ACTIVE: 'active',
  IFRAME_CONTAINER: 'bunterm-tabs-iframe-container',
  IFRAME: 'bunterm-session-iframe',
  SESSION_NAME: 'bunterm-tab-name',
  SESSION_INFO: 'bunterm-tab-info'
} as const;

/** Element IDs */
export const ELEMENT_IDS = {
  CONTAINER: 'bunterm-tabs-container',
  SIDEBAR: 'bunterm-tabs-sidebar',
  BAR: 'bunterm-tabs-bar',
  IFRAME_CONTAINER: 'bunterm-tabs-iframe-container'
} as const;
