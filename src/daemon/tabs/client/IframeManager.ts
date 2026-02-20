/**
 * IframeManager
 *
 * Manages iframe lifecycle for session switching.
 * Creates iframes on-demand and handles visibility toggling.
 */

import type { SessionInfo, TabsClientConfig } from './types.js';

export class IframeManager {
  private iframes: Map<string, HTMLIFrameElement> = new Map();
  private container: HTMLElement;
  private config: TabsClientConfig;
  private currentSession: string | null = null;

  constructor(container: HTMLElement, config: TabsClientConfig) {
    this.container = container;
    this.config = config;

    // Preload iframes if configured
    if (config.tabs.preload_iframes) {
      this.preloadAll(config.sessions);
    }
  }

  /**
   * Show a specific session's iframe
   */
  showSession(name: string): void {
    // Hide all iframes
    for (const iframe of this.iframes.values()) {
      iframe.classList.add('hidden');
    }

    // Get or create the target iframe
    let iframe = this.iframes.get(name);
    if (!iframe) {
      const session = this.config.sessions.find((s) => s.name === name);
      if (!session) {
        return;
      }
      iframe = this.createIframe(session);
      this.iframes.set(name, iframe);
    }

    // Show the iframe
    iframe.classList.remove('hidden');
    this.currentSession = name;
  }

  /**
   * Focus the current session's iframe content
   */
  focusSession(name: string): void {
    const iframe = this.iframes.get(name);
    if (iframe) {
      // Focus the iframe's content window
      try {
        iframe.contentWindow?.focus();
      } catch {
        // Cross-origin restrictions may prevent focus
        iframe.focus();
      }
    }
  }

  /**
   * Preload all session iframes
   */
  preloadAll(sessions: SessionInfo[]): void {
    for (const session of sessions) {
      if (!this.iframes.has(session.name)) {
        const iframe = this.createIframe(session);
        iframe.classList.add('hidden');
        this.iframes.set(session.name, iframe);
      }
    }
  }

  /**
   * Remove an iframe for a session that no longer exists
   */
  removeSession(name: string): void {
    const iframe = this.iframes.get(name);
    if (iframe) {
      iframe.remove();
      this.iframes.delete(name);
    }
  }

  /**
   * Update sessions list (add new, remove stale)
   */
  updateSessions(sessions: SessionInfo[]): void {
    const sessionNames = new Set(sessions.map((s) => s.name));

    // Remove iframes for sessions that no longer exist
    for (const [name] of this.iframes) {
      if (!sessionNames.has(name)) {
        this.removeSession(name);
      }
    }

    // Update config sessions
    this.config.sessions = sessions;
  }

  /**
   * Get the current session name
   */
  getCurrentSession(): string | null {
    return this.currentSession;
  }

  /**
   * Create an iframe for a session
   */
  private createIframe(session: SessionInfo): HTMLIFrameElement {
    const iframe = document.createElement('iframe');
    iframe.src = `${session.path}/`;
    iframe.className = 'ttyd-session-iframe';
    // Allow clipboard operations and fullscreen
    iframe.allow = 'clipboard-write; clipboard-read; fullscreen';
    // Set sandbox with necessary permissions
    iframe.sandbox.add('allow-same-origin');
    iframe.sandbox.add('allow-scripts');
    iframe.sandbox.add('allow-forms');
    iframe.sandbox.add('allow-popups');
    iframe.sandbox.add('allow-modals');
    // Accessibility
    iframe.title = `Terminal session: ${session.name}`;

    // Add load event listener
    iframe.addEventListener('load', () => {
      // Iframe loaded - no additional action needed
    });

    // Add error handler
    iframe.addEventListener('error', () => {
      // Iframe error - silently ignore
    });

    this.container.appendChild(iframe);
    return iframe;
  }
}
