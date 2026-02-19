/**
 * Tabs Client Type Definitions
 */

/** Session info from server */
export interface SessionInfo {
  name: string;
  path: string;
  dir: string;
}

/** Tabs configuration from server */
export interface TabsClientConfig {
  basePath: string;
  tabs: {
    enabled: boolean;
    orientation: 'horizontal' | 'vertical';
    position: 'left' | 'right' | 'top' | 'bottom';
    tab_width: number;
    tab_height: number;
    auto_refresh_interval: number;
    preload_iframes: boolean;
    show_session_info: boolean;
  };
  initialSession: string | null;
  sessions: SessionInfo[];
}

/** Tab click callback */
export type TabClickCallback = (sessionName: string) => void;

/** Session update callback */
export type SessionUpdateCallback = (sessions: SessionInfo[]) => void;

/** Extend window with tabs config */
declare global {
  interface Window {
    __TABS_CONFIG__?: TabsClientConfig;
  }
}
