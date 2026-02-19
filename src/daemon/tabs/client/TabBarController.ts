/**
 * TabBarController
 *
 * Manages the tab bar UI, including rendering tabs and handling click events.
 */

import type { SessionInfo, TabClickCallback, TabsClientConfig } from './types.js';

export class TabBarController {
  private container: HTMLElement;
  private config: TabsClientConfig;
  private onClickCallback: TabClickCallback | null = null;
  private activeSession: string | null = null;

  constructor(container: HTMLElement, config: TabsClientConfig) {
    this.container = container;
    this.config = config;

    // Bind click handler
    this.container.addEventListener('click', (e) => this.handleClick(e));
  }

  /**
   * Set the click callback
   */
  onTabClick(callback: TabClickCallback): void {
    this.onClickCallback = callback;
  }

  /**
   * Render tabs for given sessions
   */
  render(sessions: SessionInfo[], activeSession: string | null): void {
    this.activeSession = activeSession;

    // Clear existing tabs
    this.container.innerHTML = '';

    // Create tab elements
    for (const session of sessions) {
      const tab = this.createTabElement(session, session.name === activeSession);
      this.container.appendChild(tab);
    }
  }

  /**
   * Update tabs (add new, remove stale, update active)
   */
  update(sessions: SessionInfo[], activeSession: string | null): void {
    const currentTabs = this.container.querySelectorAll('.ttyd-tab');
    const sessionMap = new Map(sessions.map((s) => [s.name, s]));
    const existingNames = new Set<string>();

    // Update existing tabs
    for (const tab of currentTabs) {
      const name = (tab as HTMLElement).dataset.session;
      if (name && sessionMap.has(name)) {
        existingNames.add(name);
        // Update active state
        tab.classList.toggle('active', name === activeSession);
      } else {
        // Remove stale tab
        tab.remove();
      }
    }

    // Add new tabs
    for (const session of sessions) {
      if (!existingNames.has(session.name)) {
        const tab = this.createTabElement(session, session.name === activeSession);
        this.container.appendChild(tab);
      }
    }

    this.activeSession = activeSession;
  }

  /**
   * Set the active tab
   */
  setActive(name: string): void {
    const tabs = this.container.querySelectorAll('.ttyd-tab');
    for (const tab of tabs) {
      const tabName = (tab as HTMLElement).dataset.session;
      tab.classList.toggle('active', tabName === name);
    }
    this.activeSession = name;
  }

  /**
   * Get the currently active session name
   */
  getActiveSession(): string | null {
    return this.activeSession;
  }

  /**
   * Create a tab element
   */
  private createTabElement(session: SessionInfo, isActive: boolean): HTMLElement {
    const tab = document.createElement('div');
    tab.className = `ttyd-tab${isActive ? ' active' : ''}`;
    tab.dataset.session = session.name;
    tab.dataset.path = session.path;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'ttyd-tab-name';
    nameSpan.textContent = session.name;
    tab.appendChild(nameSpan);

    if (this.config.tabs.show_session_info) {
      const infoSpan = document.createElement('span');
      infoSpan.className = 'ttyd-tab-info';
      infoSpan.textContent = session.dir;
      tab.appendChild(infoSpan);
    }

    return tab;
  }

  /**
   * Handle click on tab container
   */
  private handleClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    const tab = target.closest('.ttyd-tab') as HTMLElement | null;

    if (tab && this.onClickCallback) {
      const sessionName = tab.dataset.session;
      if (sessionName && sessionName !== this.activeSession) {
        this.onClickCallback(sessionName);
      }
    }
  }
}
