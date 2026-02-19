/**
 * Clipboard History Manager
 *
 * Manages clipboard history for quick paste operations.
 * Shows history popup on long press of paste button.
 */

import type { InputHandler } from './InputHandler.js';
import type { ClipboardHistoryItem, ClipboardHistoryStorage } from './types.js';
import { STORAGE_KEYS } from './types.js';

const STORAGE_VERSION = 1;
const MAX_HISTORY_ITEMS = 10;
const LONG_PRESS_DURATION = 500; // ms

export class ClipboardHistoryManager {
  private inputHandler: InputHandler;
  private history: ClipboardHistoryItem[] = [];
  private pasteBtn: HTMLButtonElement | null = null;
  private popup: HTMLElement | null = null;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private isLongPress = false;

  constructor(inputHandler: InputHandler) {
    this.inputHandler = inputHandler;
    this.load();
  }

  /**
   * Bind paste button and setup event listeners
   */
  bindPasteButton(pasteBtn: HTMLButtonElement): void {
    this.pasteBtn = pasteBtn;
    this.createPopup();
    this.setupEventListeners();
  }

  /**
   * Create the popup element
   */
  private createPopup(): void {
    this.popup = document.createElement('div');
    this.popup.id = 'ttyd-clipboard-history';
    this.popup.className = 'hidden';
    this.popup.innerHTML = `
      <div id="ttyd-clipboard-history-header">
        <span>履歴</span>
        <button id="ttyd-clipboard-history-close">×</button>
      </div>
      <div id="ttyd-clipboard-history-list"></div>
    `;
    document.body.appendChild(this.popup);

    // Close button
    const closeBtn = this.popup.querySelector('#ttyd-clipboard-history-close');
    closeBtn?.addEventListener('click', () => this.hidePopup());

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (this.isPopupVisible() && !this.popup?.contains(e.target as Node) && e.target !== this.pasteBtn) {
        this.hidePopup();
      }
    });
  }

  /**
   * Setup event listeners for long press
   */
  private setupEventListeners(): void {
    if (!this.pasteBtn) return;

    // Long press detection
    this.pasteBtn.addEventListener('pointerdown', () => {
      this.isLongPress = false;
      this.longPressTimer = setTimeout(() => {
        this.isLongPress = true;
        this.showPopup();
      }, LONG_PRESS_DURATION);
    });

    this.pasteBtn.addEventListener('pointerup', () => {
      this.clearLongPressTimer();
      // Reset isLongPress after a short delay to allow click handler to check it
      setTimeout(() => {
        this.isLongPress = false;
      }, 50);
    });

    this.pasteBtn.addEventListener('pointercancel', () => {
      this.clearLongPressTimer();
      this.isLongPress = false;
    });

    this.pasteBtn.addEventListener('pointerleave', () => {
      this.clearLongPressTimer();
    });

    // Prevent context menu on long press
    this.pasteBtn.addEventListener('contextmenu', (e) => {
      if (this.isLongPress) {
        e.preventDefault();
      }
    });
  }

  /**
   * Clear long press timer
   */
  private clearLongPressTimer(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  /**
   * Check if long press is in progress
   */
  isLongPressInProgress(): boolean {
    return this.isLongPress;
  }

  /**
   * Add text to clipboard history
   */
  addToHistory(text: string): void {
    // Don't add empty or duplicate (most recent)
    if (!text.trim()) return;
    if (this.history.length > 0 && this.history[0].text === text) return;

    // Add to beginning
    const item: ClipboardHistoryItem = {
      id: this.generateId(),
      text,
      timestamp: new Date().toISOString(),
    };

    this.history.unshift(item);

    // Trim to max size
    if (this.history.length > MAX_HISTORY_ITEMS) {
      this.history = this.history.slice(0, MAX_HISTORY_ITEMS);
    }

    this.save();
    console.log('[Toolbar] Added to clipboard history');
  }

  /**
   * Send text from history to terminal
   */
  sendFromHistory(id: string): void {
    const item = this.history.find((h) => h.id === id);
    if (!item) return;

    if (this.inputHandler.sendText(item.text)) {
      console.log('[Toolbar] Sent from clipboard history');
      this.hidePopup();
    }
  }

  /**
   * Check if popup is visible
   */
  isPopupVisible(): boolean {
    return this.popup ? !this.popup.classList.contains('hidden') : false;
  }

  /**
   * Show the history popup
   */
  showPopup(): void {
    if (!this.popup || !this.pasteBtn) return;

    // Position popup above paste button
    const btnRect = this.pasteBtn.getBoundingClientRect();
    this.popup.style.bottom = `${window.innerHeight - btnRect.top + 8}px`;
    this.popup.style.left = `${Math.max(16, btnRect.left - 100)}px`;

    this.renderList();
    this.popup.classList.remove('hidden');
  }

  /**
   * Hide the history popup
   */
  hidePopup(): void {
    this.popup?.classList.add('hidden');
  }

  /**
   * Render the history list
   */
  private renderList(): void {
    const list = this.popup?.querySelector('#ttyd-clipboard-history-list');
    if (!list) return;

    list.innerHTML = '';

    if (this.history.length === 0) {
      const empty = document.createElement('div');
      empty.id = 'ttyd-clipboard-history-empty';
      empty.textContent = '履歴がありません';
      list.appendChild(empty);
      return;
    }

    for (const item of this.history) {
      const el = document.createElement('div');
      el.className = 'ttyd-clipboard-history-item';
      el.textContent = this.truncateText(item.text, 50);
      el.title = item.text;
      el.addEventListener('click', () => this.sendFromHistory(item.id));
      list.appendChild(el);
    }
  }

  /**
   * Truncate text with ellipsis
   */
  private truncateText(text: string, maxLength: number): string {
    const singleLine = text.replace(/\n/g, ' ');
    if (singleLine.length <= maxLength) {
      return singleLine;
    }
    return singleLine.slice(0, maxLength - 3) + '...';
  }

  /**
   * Load history from localStorage
   */
  private load(): void {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CLIPBOARD_HISTORY);
      if (!data) {
        this.history = [];
        return;
      }

      const storage: ClipboardHistoryStorage = JSON.parse(data);
      if (storage.version === STORAGE_VERSION && Array.isArray(storage.items)) {
        this.history = storage.items;
      } else {
        this.history = [];
      }
    } catch {
      console.warn('[Toolbar] Failed to load clipboard history');
      this.history = [];
    }
  }

  /**
   * Save history to localStorage
   */
  private save(): void {
    try {
      const storage: ClipboardHistoryStorage = {
        version: STORAGE_VERSION,
        items: this.history,
      };
      localStorage.setItem(STORAGE_KEYS.CLIPBOARD_HISTORY, JSON.stringify(storage));
    } catch {
      console.warn('[Toolbar] Failed to save clipboard history');
    }
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
