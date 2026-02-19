/**
 * Terminal Controller
 *
 * Provides methods for interacting with xterm.js terminal:
 * - Finding terminal instance
 * - Font size management
 * - Fit terminal to container
 * - Copy operations
 */

import type { ClipboardHistoryManager } from './ClipboardHistoryManager.js';
import type { InputHandler } from './InputHandler.js';
import type { Terminal, ToolbarConfig } from './types.js';

export class TerminalController {
  private config: ToolbarConfig;
  private isMobile: boolean;

  constructor(config: ToolbarConfig) {
    this.config = config;
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  }

  /**
   * Get default font size based on device type
   */
  getDefaultFontSize(): number {
    return this.isMobile
      ? this.config.font_size_default_mobile
      : this.config.font_size_default_pc;
  }

  /**
   * Find xterm.js terminal instance
   */
  findTerminal(): Terminal | null {
    if (window.term) {
      return window.term;
    }

    const termEl = document.querySelector('.xterm') as HTMLElement & { _core?: Terminal };
    if (termEl && termEl._core) {
      return termEl._core;
    }

    return null;
  }

  /**
   * Fit terminal to container size
   */
  fitTerminal(): void {
    if (window.fitAddon && typeof window.fitAddon.fit === 'function') {
      window.fitAddon.fit();
      console.log('[Toolbar] Terminal fitted via fitAddon');
      return;
    }

    const term = window.term as Terminal & { fitAddon?: { fit: () => void } };
    if (term && term.fitAddon && typeof term.fitAddon.fit === 'function') {
      term.fitAddon.fit();
      console.log('[Toolbar] Terminal fitted via term.fitAddon');
      return;
    }

    window.dispatchEvent(new Event('resize'));
    console.log('[Toolbar] Dispatched resize event');
  }

  /**
   * Get current font size
   */
  getCurrentFontSize(): number {
    const term = this.findTerminal();
    if (term?.options) {
      return term.options.fontSize ?? this.getDefaultFontSize();
    }
    return this.getDefaultFontSize();
  }

  /**
   * Set font size with bounds checking
   */
  setFontSize(size: number): boolean {
    const term = this.findTerminal();
    if (!term?.options) {
      console.log('[Toolbar] Terminal not found for zoom');
      return false;
    }

    const clampedSize = Math.max(
      this.config.font_size_min,
      Math.min(this.config.font_size_max, size)
    );

    term.options.fontSize = clampedSize;
    this.fitTerminal();
    console.log('[Toolbar] Font size changed to ' + clampedSize);
    return true;
  }

  /**
   * Zoom terminal font size by delta
   */
  zoomTerminal(delta: number): boolean {
    const currentSize = this.getCurrentFontSize();
    return this.setFontSize(currentSize + delta);
  }

  /**
   * Copy current selection to clipboard
   */
  copySelection(): Promise<boolean> {
    const term = this.findTerminal();
    if (!term) {
      console.log('[Toolbar] Terminal not found for copy');
      return Promise.resolve(false);
    }

    const selection = term.getSelection();
    if (!selection) {
      console.log('[Toolbar] No text selected');
      return Promise.resolve(false);
    }

    return navigator.clipboard
      .writeText(selection)
      .then(() => {
        console.log('[Toolbar] Copied selection to clipboard');
        return true;
      })
      .catch((err) => {
        console.error('[Toolbar] Failed to copy:', err);
        return false;
      });
  }

  /**
   * Paste from clipboard to terminal
   */
  async paste(inputHandler: InputHandler, historyManager?: ClipboardHistoryManager): Promise<boolean> {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return false;
      const result = inputHandler.sendText(text);
      if (result && historyManager) {
        historyManager.addToHistory(text);
      }
      return result;
    } catch (err) {
      console.error('[Toolbar] Failed to read clipboard:', err);
      return false;
    }
  }

  /**
   * Copy all terminal buffer content to clipboard
   */
  copyAll(): Promise<boolean> {
    const term = this.findTerminal();
    if (!term?.buffer?.active) {
      console.log('[Toolbar] Terminal buffer not found');
      return Promise.resolve(false);
    }

    const buffer = term.buffer.active;
    const lines: string[] = [];

    for (let i = 0; i < buffer.length; i++) {
      const line = buffer.getLine(i);
      if (line) {
        lines.push(line.translateToString(true));
      }
    }

    const text = lines.join('\n').trimEnd();

    return navigator.clipboard
      .writeText(text)
      .then(() => {
        console.log('[Toolbar] Copied all text to clipboard');
        return true;
      })
      .catch((err) => {
        console.error('[Toolbar] Failed to copy:', err);
        return false;
      });
  }

  /**
   * Setup visual bell handler
   */
  setupBellHandler(onBell: () => void): void {
    const term = this.findTerminal();
    if (!term?.onBell) {
      // Retry later if terminal not ready
      setTimeout(() => this.setupBellHandler(onBell), 500);
      return;
    }

    term.onBell(() => {
      console.log('[Toolbar] Bell detected (visual feedback)');
      onBell();

      // Visual bell effect - flash the terminal
      const termEl = term.element;
      if (termEl) {
        termEl.classList.add('bell-flash');
        setTimeout(() => {
          termEl.classList.remove('bell-flash');
        }, 100);
      }
    });

    console.log('[Toolbar] Visual bell handler registered');
  }
}
