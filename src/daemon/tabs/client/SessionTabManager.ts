/**
 * SessionTabManager
 *
 * Main orchestrator for the session tabs feature.
 * Coordinates TabBarController and IframeManager.
 */

import { IframeManager } from './IframeManager.js';
import { TabBarController } from './TabBarController.js';
import type { SessionInfo, TabsClientConfig } from './types.js';

/** Storage key for last selected session */
const LAST_SESSION_KEY = 'ttyd-tabs-last-session';

export class SessionTabManager {
  private config: TabsClientConfig;
  private tabBar: TabBarController;
  private iframeManager: IframeManager;
  private currentSession: string | null = null;
  private pollInterval: number | null = null;

  constructor(config: TabsClientConfig) {
    this.config = config;

    // Get container elements
    const tabBarElement = document.getElementById('ttyd-tabs-bar');
    const iframeContainer = document.getElementById('ttyd-tabs-iframe-container');

    if (!tabBarElement || !iframeContainer) {
      throw new Error('[Tabs] Required elements not found');
    }

    // Initialize controllers
    this.tabBar = new TabBarController(tabBarElement, config);
    this.iframeManager = new IframeManager(iframeContainer, config);
  }

  /**
   * Initialize the session tab manager
   */
  initialize(): void {
    // Parse session from URL
    const urlSession = this.parseSessionFromUrl();

    // Determine initial session
    this.currentSession = urlSession || this.getLastSession() || this.config.initialSession;

    // Setup tab bar
    this.tabBar.onTabClick((name) => this.switchSession(name));
    this.tabBar.render(this.config.sessions, this.currentSession);

    // Show initial session if there are sessions
    if (this.currentSession && this.config.sessions.length > 0) {
      this.iframeManager.showSession(this.currentSession);
      this.saveLastSession(this.currentSession);
    }

    // Setup browser history handling
    this.setupHistoryHandler();

    // Start polling for session updates
    this.startPolling();

    // Handle visibility change
    this.setupVisibilityHandler();
  }

  /**
   * Switch to a different session
   */
  switchSession(name: string, pushState = true): void {
    if (name === this.currentSession) {
      return;
    }

    this.currentSession = name;
    this.tabBar.setActive(name);
    this.iframeManager.showSession(name);
    this.saveLastSession(name);

    // Update browser history
    if (pushState) {
      const newUrl = `${this.config.basePath}/tabs/${encodeURIComponent(name)}`;
      history.pushState({ session: name }, '', newUrl);
    }

    // Focus the iframe content
    setTimeout(() => this.iframeManager.focusSession(name), 100);
  }

  /**
   * Fetch latest sessions from API
   */
  async fetchSessions(): Promise<SessionInfo[]> {
    try {
      const response = await fetch(`${this.config.basePath}/api/sessions`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.map((s: { name: string; fullPath: string; dir: string }) => ({
        name: s.name,
        path: s.fullPath,
        dir: s.dir
      }));
    } catch (_error) {
      return this.config.sessions;
    }
  }

  /**
   * Parse session name from current URL
   */
  private parseSessionFromUrl(): string | null {
    const pathname = window.location.pathname;
    const basePath = this.config.basePath;
    const tabsPath = `${basePath}/tabs/`;

    if (pathname.startsWith(tabsPath)) {
      const sessionPart = pathname.slice(tabsPath.length);
      // Remove trailing slash and decode
      const sessionName = decodeURIComponent(sessionPart.replace(/\/$/, ''));
      return sessionName || null;
    }

    return null;
  }

  /**
   * Get last selected session from localStorage
   */
  private getLastSession(): string | null {
    try {
      return localStorage.getItem(LAST_SESSION_KEY);
    } catch {
      return null;
    }
  }

  /**
   * Save last selected session to localStorage
   */
  private saveLastSession(name: string): void {
    try {
      localStorage.setItem(LAST_SESSION_KEY, name);
    } catch {
      // Ignore localStorage errors
    }
  }

  /**
   * Setup browser history (popstate) handler
   */
  private setupHistoryHandler(): void {
    window.addEventListener('popstate', (e) => {
      const state = e.state as { session?: string } | null;
      if (state?.session) {
        this.switchSession(state.session, false);
      } else {
        // Try to parse from URL
        const urlSession = this.parseSessionFromUrl();
        if (urlSession) {
          this.switchSession(urlSession, false);
        }
      }
    });
  }

  /**
   * Start polling for session updates
   */
  private startPolling(): void {
    const interval = this.config.tabs.auto_refresh_interval;

    this.pollInterval = window.setInterval(async () => {
      const sessions = await this.fetchSessions();
      this.updateSessions(sessions);
    }, interval);
  }

  /**
   * Stop polling
   */
  private stopPolling(): void {
    if (this.pollInterval !== null) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Update sessions list
   */
  private updateSessions(sessions: SessionInfo[]): void {
    // Check if sessions changed
    const currentNames = new Set(this.config.sessions.map((s) => s.name));
    const newNames = new Set(sessions.map((s) => s.name));

    const hasChanges =
      currentNames.size !== newNames.size ||
      [...currentNames].some((name) => !newNames.has(name)) ||
      [...newNames].some((name) => !currentNames.has(name));

    if (!hasChanges) {
      return;
    }

    // Update config
    this.config.sessions = sessions;

    // Update tab bar
    this.tabBar.update(sessions, this.currentSession);

    // Update iframe manager
    this.iframeManager.updateSessions(sessions);

    // If current session no longer exists, switch to first available
    if (this.currentSession && !newNames.has(this.currentSession)) {
      const firstSession = sessions[0]?.name;
      if (firstSession) {
        this.switchSession(firstSession);
      } else {
        // No sessions left
        this.currentSession = null;
      }
    }
  }

  /**
   * Setup visibility change handler
   */
  private setupVisibilityHandler(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Page is hidden, could pause polling
      } else {
        // Page is visible, refresh sessions immediately
        this.fetchSessions().then((sessions) => this.updateSessions(sessions));
      }
    });
  }
}
