/**
 * Tabs Configuration Constants
 */

/** LocalStorage key prefix for tabs state */
export const STORAGE_PREFIX = 'ttyd-tabs-';

/** LocalStorage key for last selected session */
export const LAST_SESSION_KEY = `${STORAGE_PREFIX}last-session`;

/** CSS class names */
export const CSS_CLASSES = {
  CONTAINER: 'ttyd-tabs-container',
  SIDEBAR: 'ttyd-tabs-sidebar',
  BAR: 'ttyd-tabs-bar',
  TAB: 'ttyd-tab',
  TAB_ACTIVE: 'active',
  IFRAME_CONTAINER: 'ttyd-tabs-iframe-container',
  IFRAME: 'ttyd-session-iframe',
  SESSION_NAME: 'ttyd-tab-name',
  SESSION_INFO: 'ttyd-tab-info'
} as const;

/** Element IDs */
export const ELEMENT_IDS = {
  CONTAINER: 'ttyd-tabs-container',
  SIDEBAR: 'ttyd-tabs-sidebar',
  BAR: 'ttyd-tabs-bar',
  IFRAME_CONTAINER: 'ttyd-tabs-iframe-container'
} as const;
