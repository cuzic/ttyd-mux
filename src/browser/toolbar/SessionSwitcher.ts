/**
 * Session Switcher Manager
 *
 * Handles session switching modal functionality:
 * - Load sessions from API
 * - Display session list with search filtering
 * - Keyboard navigation (arrow keys, Enter, Escape)
 * - Navigate to selected session
 */

import { toolbarEvents } from '@/browser/shared/events.js';
import type { Mountable, Scope } from '@/browser/shared/lifecycle.js';
import type { SessionSwitcherElements, TerminalUiConfig } from '@/browser/shared/types.js';
import {
  bindBackdropClose,
  bindClickScoped,
  getSessionName,
  renderEmptyState
} from '@/browser/shared/utils.js';
import { fetchJSON } from './ApiClient.js';

/** Session data from API */
interface SessionInfo {
  name: string;
  dir: string;
  path: string;
  fullPath: string;
}

/** Tmux session data from API */
interface TmuxSessionInfo {
  name: string;
  windows: number;
  created: string;
  attached: boolean;
}

export class SessionSwitcher implements Mountable {
  private config: TerminalUiConfig;
  private elements: SessionSwitcherElements | null = null;
  private sessions: SessionInfo[] = [];
  private filteredSessions: SessionInfo[] = [];
  private tmuxSessions: TmuxSessionInfo[] = [];
  private filteredTmuxSessions: TmuxSessionInfo[] = [];
  private tmuxInstalled = false;
  private selectedIndex = 0;
  private selectedSection: 'bunterm' | 'tmux' = 'bunterm';
  private currentSessionName: string | null = null;
  private isVisible = false;

  constructor(config: TerminalUiConfig) {
    this.config = config;
    const sessionName = getSessionName(config);
    this.currentSessionName = sessionName || null;
  }

  /**
   * Bind DOM elements (stores reference only)
   */
  bindElements(elements: SessionSwitcherElements): void {
    this.elements = elements;
  }

  /**
   * Mount event listeners to scope for automatic cleanup
   */
  mount(scope: Scope): void {
    const { elements } = this;
    if (!elements) {
      return;
    }

    // Close button
    bindClickScoped(scope, elements.modalClose, () => this.hide());

    // Refresh button
    bindClickScoped(scope, elements.refreshBtn, () => this.loadSessions());

    // Session button in toolbar
    bindClickScoped(scope, elements.sessionBtn, () => this.toggle());

    // Search input
    scope.on(elements.searchInput, 'input', () => {
      this.filterSessions();
      this.selectedIndex = 0;
      this.renderSessions();
    });

    // Keyboard navigation
    scope.on(elements.searchInput, 'keydown', (e: Event) => this.handleKeydown(e as KeyboardEvent));
    scope.on(elements.modal, 'keydown', (e: Event) => this.handleKeydown(e as KeyboardEvent));

    // Close on backdrop click
    bindBackdropClose(scope, elements.modal, () => this.hide());

    // Event delegation for session list clicks (avoids memory leak from per-item listeners)
    scope.on(elements.sessionList, 'click', (e: Event) => {
      const target = (e.target as HTMLElement).closest('.tui-session-item') as HTMLElement | null;
      if (!target) return;

      const section = target.getAttribute('data-section');
      const index = Number.parseInt(target.getAttribute('data-index') ?? '', 10);

      if (section === 'bunterm') {
        if (!Number.isNaN(index) && index >= 0 && index < this.filteredSessions.length) {
          const session = this.filteredSessions[index];
          if (session) this.navigateToSession(session);
        }
      } else if (section === 'tmux') {
        if (!Number.isNaN(index) && index >= 0 && index < this.filteredTmuxSessions.length) {
          const tmuxSession = this.filteredTmuxSessions[index];
          if (tmuxSession) this.connectToTmuxSession(tmuxSession);
        }
      }
    });

    // Listen for session:open event
    scope.onBus(toolbarEvents, 'session:open', () => this.show());
  }

  /**
   * Handle keyboard events
   */
  private handleKeydown(e: KeyboardEvent): void {
    if (!this.isVisible) {
      return;
    }

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        this.selectNext();
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        this.selectPrevious();
        break;
      }
      case 'Tab': {
        // Switch between bunterm and tmux sections
        if (this.tmuxInstalled && this.tmuxSessions.length > 0) {
          e.preventDefault();
          this.selectedSection = this.selectedSection === 'bunterm' ? 'tmux' : 'bunterm';
          this.selectedIndex = 0;
          this.renderSessions();
        }
        break;
      }
      case 'Enter': {
        e.preventDefault();
        this.navigateToSelected();
        break;
      }
      case 'Escape': {
        e.preventDefault();
        this.hide();
        break;
      }
    }
  }

  /**
   * Get the current list based on selected section
   */
  private getCurrentList(): SessionInfo[] | TmuxSessionInfo[] {
    return this.selectedSection === 'bunterm' ? this.filteredSessions : this.filteredTmuxSessions;
  }

  /**
   * Select next session in list
   */
  private selectNext(): void {
    const currentList = this.getCurrentList();
    if (currentList.length === 0) {
      // Try to switch to the other section
      if (this.selectedSection === 'bunterm' && this.filteredTmuxSessions.length > 0) {
        this.selectedSection = 'tmux';
        this.selectedIndex = 0;
      } else if (this.selectedSection === 'tmux' && this.filteredSessions.length > 0) {
        this.selectedSection = 'bunterm';
        this.selectedIndex = 0;
      } else {
        return;
      }
    } else {
      const newIndex = this.selectedIndex + 1;
      if (newIndex >= currentList.length) {
        // Move to next section or wrap around
        if (this.selectedSection === 'bunterm' && this.filteredTmuxSessions.length > 0) {
          this.selectedSection = 'tmux';
          this.selectedIndex = 0;
        } else if (this.selectedSection === 'tmux' && this.filteredSessions.length > 0) {
          this.selectedSection = 'bunterm';
          this.selectedIndex = 0;
        } else {
          this.selectedIndex = 0;
        }
      } else {
        this.selectedIndex = newIndex;
      }
    }
    this.renderSessions();
    this.scrollToSelected();
  }

  /**
   * Select previous session in list
   */
  private selectPrevious(): void {
    const currentList = this.getCurrentList();
    if (currentList.length === 0) {
      // Try to switch to the other section
      if (this.selectedSection === 'bunterm' && this.filteredTmuxSessions.length > 0) {
        this.selectedSection = 'tmux';
        this.selectedIndex = this.filteredTmuxSessions.length - 1;
      } else if (this.selectedSection === 'tmux' && this.filteredSessions.length > 0) {
        this.selectedSection = 'bunterm';
        this.selectedIndex = this.filteredSessions.length - 1;
      } else {
        return;
      }
    } else {
      const newIndex = this.selectedIndex - 1;
      if (newIndex < 0) {
        // Move to previous section or wrap around
        if (this.selectedSection === 'tmux' && this.filteredSessions.length > 0) {
          this.selectedSection = 'bunterm';
          this.selectedIndex = this.filteredSessions.length - 1;
        } else if (this.selectedSection === 'bunterm' && this.filteredTmuxSessions.length > 0) {
          this.selectedSection = 'tmux';
          this.selectedIndex = this.filteredTmuxSessions.length - 1;
        } else {
          this.selectedIndex = currentList.length - 1;
        }
      } else {
        this.selectedIndex = newIndex;
      }
    }
    this.renderSessions();
    this.scrollToSelected();
  }

  /**
   * Scroll to keep selected item visible
   */
  private scrollToSelected(): void {
    const selectedEl = this.elements?.sessionList.querySelector('.tui-session-item.selected');
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  /**
   * Navigate to selected session
   */
  private navigateToSelected(): void {
    if (this.selectedSection === 'bunterm') {
      const session = this.filteredSessions[this.selectedIndex];
      if (session) {
        this.navigateToSession(session);
      }
    } else {
      const tmuxSession = this.filteredTmuxSessions[this.selectedIndex];
      if (tmuxSession) {
        this.connectToTmuxSession(tmuxSession);
      }
    }
  }

  /**
   * Navigate to a session (opens in new tab)
   */
  private navigateToSession(session: SessionInfo): void {
    if (session.name === this.currentSessionName) {
      // Already on this session, just close the modal
      this.hide();
      return;
    }
    // Open in new tab
    window.open(session.fullPath, '_blank');
    this.hide();
  }

  /**
   * Connect to a tmux session by creating a bunterm session that attaches to it
   */
  private async connectToTmuxSession(tmuxSession: TmuxSessionInfo): Promise<void> {
    // Check if there's an existing bunterm session for this tmux session
    const sessions = await fetchJSON<Array<{ name: string; tmuxSession?: string }>>(
      `${this.config.base_path}/api/sessions`
    );
    const existing = sessions?.find((s) => s.tmuxSession === tmuxSession.name);

    if (existing) {
      // Open existing session
      const fullPath = `${this.config.base_path}/${encodeURIComponent(existing.name)}/`;
      window.open(fullPath, '_blank');
      this.hide();
      return;
    }

    // Use the same name as tmux session
    const sessionName = tmuxSession.name;

    const data = await fetchJSON<{ name: string }>(`${this.config.base_path}/api/sessions`, {
      method: 'POST',
      body: { name: sessionName, dir: '.', tmuxSession: tmuxSession.name }
    });

    if (!data) {
      // Failed to connect - user will see the modal still open
      return;
    }

    // Open in new tab
    const fullPath = `${this.config.base_path}/${encodeURIComponent(data.name)}/`;
    window.open(fullPath, '_blank');
    this.hide();
  }

  /**
   * Show the modal
   */
  async show(): Promise<void> {
    if (!this.elements) {
      return;
    }

    this.isVisible = true;
    this.elements.modal.classList.remove('hidden');
    this.elements.searchInput.value = '';
    this.elements.searchInput.focus();

    await this.loadSessions();

    toolbarEvents.emit('modal:open', 'session');
  }

  /**
   * Hide the modal
   */
  hide(): void {
    if (!this.elements) {
      return;
    }

    this.isVisible = false;
    this.elements.modal.classList.add('hidden');
    this.selectedIndex = 0;

    toolbarEvents.emit('modal:close', 'session');
  }

  /**
   * Toggle modal visibility
   */
  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Load sessions from API
   */
  async loadSessions(): Promise<void> {
    if (!this.elements) {
      return;
    }

    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'tui-session-loading';
    loadingDiv.textContent = '読み込み中...';
    this.elements.sessionList.replaceChildren(loadingDiv);

    try {
      // Load both bunterm sessions and tmux sessions in parallel
      const [sessionsResponse, tmuxResponse] = await Promise.all([
        fetch(`${this.config.base_path}/api/sessions`),
        fetch(`${this.config.base_path}/api/tmux/sessions`)
      ]);

      // Check if component is still mounted after async operation
      if (!this.elements) return;

      if (!sessionsResponse.ok) {
        throw new Error('Failed to fetch sessions');
      }

      const sessionsData = (await sessionsResponse.json()) as SessionInfo[];

      // Check again after json() parsing
      if (!this.elements) return;

      this.sessions = sessionsData.map((s) => ({
        name: s.name,
        dir: s.dir,
        path: s.path,
        fullPath: `${this.config.base_path}/${encodeURIComponent(s.name)}/`
      }));

      // Load tmux sessions if available
      if (tmuxResponse.ok) {
        const tmuxData = (await tmuxResponse.json()) as {
          sessions: TmuxSessionInfo[];
          installed: boolean;
        };
        if (!this.elements) return;
        this.tmuxInstalled = tmuxData.installed;
        this.tmuxSessions = tmuxData.sessions;
      } else {
        this.tmuxInstalled = false;
        this.tmuxSessions = [];
      }

      this.filterSessions();
      this.renderSessions();
    } catch (_error) {
      if (!this.elements) return;
      const errorDiv = document.createElement('div');
      errorDiv.id = 'tui-session-error';
      errorDiv.textContent = 'セッションの読み込みに失敗しました';
      this.elements.sessionList.replaceChildren(errorDiv);
    }
  }

  /**
   * Filter sessions based on search input
   */
  private filterSessions(): void {
    const query = this.elements?.searchInput.value.toLowerCase() ?? '';

    // Filter bunterm sessions
    if (query) {
      this.filteredSessions = this.sessions.filter(
        (s) => s.name.toLowerCase().includes(query) || s.dir.toLowerCase().includes(query)
      );
    } else {
      this.filteredSessions = [...this.sessions];
    }

    // Sort: current session first, then alphabetically
    this.filteredSessions.sort((a, b) => {
      const aCurrent = a.name === this.currentSessionName;
      const bCurrent = b.name === this.currentSessionName;
      if (aCurrent && !bCurrent) {
        return -1;
      }
      if (!aCurrent && bCurrent) {
        return 1;
      }
      return a.name.localeCompare(b.name);
    });

    // Filter tmux sessions
    if (query) {
      this.filteredTmuxSessions = this.tmuxSessions.filter((s) =>
        s.name.toLowerCase().includes(query)
      );
    } else {
      this.filteredTmuxSessions = [...this.tmuxSessions];
    }

    // Sort tmux sessions: attached first, then alphabetically
    this.filteredTmuxSessions.sort((a, b) => {
      if (a.attached && !b.attached) {
        return -1;
      }
      if (!a.attached && b.attached) {
        return 1;
      }
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Render session list
   */
  private renderSessions(): void {
    if (!this.elements) {
      return;
    }

    const hasBuntermSessions = this.filteredSessions.length > 0;
    const hasTmuxSessions = this.tmuxInstalled && this.filteredTmuxSessions.length > 0;

    if (!hasBuntermSessions && !hasTmuxSessions) {
      renderEmptyState(this.elements.sessionList, 'セッションが見つかりません', {
        id: 'tui-session-empty'
      });
      return;
    }

    const fragment = document.createDocumentFragment();

    // Bunterm sessions section
    if (hasBuntermSessions) {
      const section = document.createElement('div');
      section.className = 'tui-session-section';

      const sectionHeader = document.createElement('div');
      sectionHeader.className = 'tui-session-section-header';
      sectionHeader.textContent = 'bunterm Sessions';
      section.appendChild(sectionHeader);

      this.filteredSessions.forEach((session, index) => {
        const isCurrent = session.name === this.currentSessionName;
        const isSelected = this.selectedSection === 'bunterm' && index === this.selectedIndex;
        const classes = [
          'tui-session-item',
          isCurrent ? 'current' : '',
          isSelected ? 'selected' : ''
        ]
          .filter(Boolean)
          .join(' ');

        const item = document.createElement('div');
        item.className = classes;
        item.dataset.section = 'bunterm';
        item.dataset.index = String(index);

        const icon = document.createElement('span');
        icon.className = 'tui-session-icon';
        icon.textContent = isCurrent ? '📍' : '📁';
        item.appendChild(icon);

        const info = document.createElement('div');
        info.className = 'tui-session-info';

        const nameDiv = document.createElement('div');
        nameDiv.className = 'tui-session-name';
        nameDiv.textContent = session.name;

        const pathDiv = document.createElement('div');
        pathDiv.className = 'tui-session-path';
        pathDiv.textContent = session.dir;

        info.appendChild(nameDiv);
        info.appendChild(pathDiv);
        item.appendChild(info);

        if (isCurrent) {
          const badge = document.createElement('span');
          badge.className = 'tui-session-current-badge';
          badge.textContent = '現在';
          item.appendChild(badge);
        }

        section.appendChild(item);
      });

      fragment.appendChild(section);
    }

    // Tmux sessions section
    if (hasTmuxSessions) {
      const section = document.createElement('div');
      section.className = 'tui-session-section tui-tmux-section';

      const sectionHeader = document.createElement('div');
      sectionHeader.className = 'tui-session-section-header';
      sectionHeader.textContent = 'tmux Sessions';
      section.appendChild(sectionHeader);

      this.filteredTmuxSessions.forEach((tmuxSession, index) => {
        const isSelected = this.selectedSection === 'tmux' && index === this.selectedIndex;
        const classes = [
          'tui-session-item',
          'tui-tmux-item',
          tmuxSession.attached ? 'attached' : '',
          isSelected ? 'selected' : ''
        ]
          .filter(Boolean)
          .join(' ');

        const meta = `${tmuxSession.windows} window${tmuxSession.windows !== 1 ? 's' : ''}`;

        const item = document.createElement('div');
        item.className = classes;
        item.dataset.section = 'tmux';
        item.dataset.index = String(index);

        const icon = document.createElement('span');
        icon.className = 'tui-session-icon';
        icon.textContent = '🖥️';
        item.appendChild(icon);

        const info = document.createElement('div');
        info.className = 'tui-session-info';

        const nameDiv = document.createElement('div');
        nameDiv.className = 'tui-session-name';
        nameDiv.textContent = tmuxSession.name;

        const pathDiv = document.createElement('div');
        pathDiv.className = 'tui-session-path';
        pathDiv.textContent = meta;

        info.appendChild(nameDiv);
        info.appendChild(pathDiv);
        item.appendChild(info);

        if (tmuxSession.attached) {
          const badge = document.createElement('span');
          badge.className = 'tui-session-attached-badge';
          badge.textContent = 'attached';
          item.appendChild(badge);
        }

        section.appendChild(item);
      });

      fragment.appendChild(section);
    }

    this.elements.sessionList.replaceChildren(fragment);
    // Click handlers are managed via event delegation in mount() for proper cleanup
  }
}
