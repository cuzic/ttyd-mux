/**
 * xterm.js Bundle Entry Point
 *
 * This file bundles xterm.js and its addons for use in the browser.
 * It exports the Terminal class and addon instances for use by terminal-client.js.
 */

import { ClipboardAddon } from '@xterm/addon-clipboard';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { SerializeAddon } from '@xterm/addon-serialize';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';

import type { IDisposable } from '@xterm/xterm';

import { DeferredClipboardProvider } from './DeferredClipboardProvider.js';
import { registerMultiLineLinkProvider } from './MultiLineLinkProvider.js';

export {
  Terminal,
  FitAddon,
  WebLinksAddon,
  Unicode11Addon,
  SerializeAddon,
  SearchAddon,
  ClipboardAddon,
  registerMultiLineLinkProvider
};

/**
 * Check if data contains mouse escape sequences.
 * Mouse sequences that shells don't understand cause garbage output.
 *
 * Patterns:
 * - X10 mode: \x1b[M followed by 3 bytes (Cb Cx Cy)
 * - SGR mode: \x1b[< followed by parameters and M or m
 * - URXVT mode: \x1b[ followed by parameters and M
 */
export function containsMouseSequence(data: string): boolean {
  // X10 mouse mode: ESC [ M Cb Cx Cy (6 bytes total)
  if (data.includes('\x1b[M')) {
    return true;
  }

  // SGR extended mouse mode: ESC [ < Cb ; Cx ; Cy M (or m for release)
  // Example: \x1b[<0;27;10M
  if (/\x1b\[<[\d;]+[Mm]/.test(data)) {
    return true;
  }

  // URXVT mode: ESC [ Cb ; Cx ; Cy M
  // Similar to SGR but without the '<'
  if (/\x1b\[\d+;\d+;\d+M/.test(data)) {
    return true;
  }

  return false;
}

/**
 * Filter out mouse escape sequences from input data.
 * Returns the data with mouse sequences removed, or empty string if only mouse data.
 */
export function filterMouseSequences(data: string): string {
  // X10 mouse mode: ESC [ M Cb Cx Cy (always 6 bytes)
  // Remove all occurrences
  let filtered = data.replace(/\x1b\[M.../g, '');

  // SGR extended mouse mode: ESC [ < params M/m
  filtered = filtered.replace(/\x1b\[<[\d;]+[Mm]/g, '');

  // URXVT mode: ESC [ params M
  filtered = filtered.replace(/\x1b\[\d+;\d+;\d+M/g, '');

  return filtered;
}

/**
 * Create a fully configured Terminal instance with all addons
 */
export function createTerminal(options?: {
  fontSize?: number;
  fontFamily?: string;
  cursorBlink?: boolean;
  scrollback?: number;
  /** Disable mouse reporting to PTY (prevents garbage when shell doesn't handle mouse) */
  disableMouseReporting?: boolean;
}): {
  terminal: Terminal;
  fitAddon: FitAddon;
  webLinksAddon: WebLinksAddon;
  unicode11Addon: Unicode11Addon;
  serializeAddon: SerializeAddon;
  searchAddon: SearchAddon;
  clipboardAddon: ClipboardAddon;
} {
  const terminal = new Terminal({
    fontSize: options?.fontSize ?? 14,
    fontFamily: options?.fontFamily ?? 'Menlo, Monaco, "Courier New", monospace',
    cursorBlink: options?.cursorBlink ?? true,
    scrollback: options?.scrollback ?? 10000,
    allowProposedApi: true,
    // Scroll settings
    scrollOnUserInput: true, // Auto-scroll to bottom on user input
    scrollSensitivity: 1, // Normal scroll speed multiplier
    fastScrollModifier: 'alt', // Hold Alt for fast scroll
    fastScrollSensitivity: 5, // Fast scroll multiplier
    smoothScrollDuration: 0, // Instant scroll (0 = no animation)
    // Selection settings
    // Double-click: select word (built-in)
    // Triple-click: select line (built-in)
    // Shift+click: extend selection (built-in)
    wordSeparator: ' ()[]{}\'"`,;:@#$%^&*=+|\\<>~', // Characters that separate words
    rightClickSelectsWord: false, // We use right-click for paste instead
    altClickMovesCursor: true, // Alt+click moves cursor (default)
    macOptionClickForcesSelection: true, // Option+click forces selection on Mac
    theme: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#d4d4d4',
      cursorAccent: '#1e1e1e',
      selectionBackground: 'rgba(255, 255, 255, 0.3)'
    }
  });

  const fitAddon = new FitAddon();
  // Open links in new tab when clicked (Ctrl+click or Cmd+click on macOS)
  const webLinksAddon = new WebLinksAddon((_event, uri) => {
    window.open(uri, '_blank', 'noopener,noreferrer');
  });
  const unicode11Addon = new Unicode11Addon();
  const serializeAddon = new SerializeAddon();
  const searchAddon = new SearchAddon();

  // Create deferred clipboard provider for OSC 52 support
  // Browser security blocks clipboard writes without user gestures,
  // so we defer writes until the next user interaction
  const clipboardProvider = new DeferredClipboardProvider({
    onDeferred: (text) => {
      // Show notification that text is ready to copy
      showClipboardNotification(text, 'Click to copy to clipboard');
    },
    onCopied: (text) => {
      // Show brief success feedback
      showClipboardNotification(text, 'Copied!', 1500);
    }
  });
  const clipboardAddon = new ClipboardAddon(undefined, clipboardProvider);

  terminal.loadAddon(fitAddon);
  terminal.loadAddon(webLinksAddon);
  terminal.loadAddon(unicode11Addon);
  terminal.loadAddon(serializeAddon);
  terminal.loadAddon(searchAddon);
  terminal.loadAddon(clipboardAddon);

  // Enable Unicode 11 support
  terminal.unicode.activeVersion = '11';

  return {
    terminal,
    fitAddon,
    webLinksAddon,
    unicode11Addon,
    serializeAddon,
    searchAddon,
    clipboardAddon
  };
}

/**
 * Setup auto-copy selection to clipboard on mouseup
 * Call this after terminal.open() since terminal.element is only available after opening
 */
export function setupSelectionAutoCopy(terminal: Terminal): void {
  if (!terminal.element) {
    return;
  }

  terminal.element.addEventListener('mouseup', () => {
    const selection = terminal.getSelection();
    if (selection) {
      navigator.clipboard.writeText(selection).catch(() => {
        // Clipboard write failed (likely due to permissions)
        // Silently ignore - user can still use Ctrl+Shift+C
      });
    }
  });
}

/**
 * Setup right-click to paste from clipboard
 * Call this after terminal.open() since terminal.element is only available after opening
 */
export function setupRightClickPaste(terminal: Terminal, sendInput: (data: string) => void): void {
  if (!terminal.element) {
    return;
  }

  terminal.element.addEventListener('contextmenu', async (e) => {
    e.preventDefault();

    // If there's a selection, don't paste (user might want to copy)
    if (terminal.hasSelection()) {
      // Clear selection and let user right-click again to paste
      terminal.clearSelection();
      return;
    }

    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        sendInput(text);
      }
    } catch {
      // Clipboard API may fail due to permissions or focus
    }
  });
}

/**
 * Setup selection highlight - highlight all occurrences of selected text
 * Uses SearchAddon for highlighting
 * Call this after terminal.open() since terminal.element is only available after opening
 */
export function setupSelectionHighlight(terminal: Terminal, searchAddon: SearchAddon): IDisposable {
  let highlightTimeout: number | null = null;
  let lastSelection = '';

  const clearHighlight = () => {
    if (highlightTimeout) {
      window.clearTimeout(highlightTimeout);
      highlightTimeout = null;
    }
    searchAddon.clearDecorations();
    lastSelection = '';
  };

  const highlightSelection = () => {
    const selection = terminal.getSelection();

    // Clear if no selection or same as before
    if (!selection || selection === lastSelection) {
      if (!selection) {
        clearHighlight();
      }
      return;
    }

    // Don't highlight whitespace-only or very short selections
    const trimmed = selection.trim();
    if (trimmed.length < 2) {
      clearHighlight();
      return;
    }

    // Don't highlight very long selections (performance)
    if (selection.length > 100) {
      clearHighlight();
      return;
    }

    lastSelection = selection;

    // Escape special regex characters for literal search
    const escaped = selection.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Search with decorations (this highlights all matches)
    searchAddon.findNext(escaped, {
      regex: true,
      caseSensitive: true,
      decorations: {
        matchBackground: '#264f78', // Blue-ish background
        matchBorder: '#3794ff',
        matchOverviewRuler: '#3794ff',
        activeMatchBackground: '#515c6a', // Slightly different for active
        activeMatchBorder: '#74b0f3',
        activeMatchColorOverviewRuler: '#74b0f3'
      }
    });
  };

  // Debounced highlight on selection change
  const onSelectionChange = terminal.onSelectionChange(() => {
    if (highlightTimeout) {
      window.clearTimeout(highlightTimeout);
    }
    highlightTimeout = window.setTimeout(highlightSelection, 150);
  });

  // Clear highlights when terminal loses focus
  const onBlur = () => {
    clearHighlight();
  };

  terminal.element?.addEventListener('blur', onBlur);

  return {
    dispose: () => {
      onSelectionChange.dispose();
      terminal.element?.removeEventListener('blur', onBlur);
      clearHighlight();
    }
  };
}

// === OSC 52 Clipboard Notification ===

let notificationElement: HTMLDivElement | null = null;
let notificationTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingClipboardText: string | null = null;

/**
 * Show a notification for clipboard operations (OSC 52)
 * @param text - The text that was/should be copied
 * @param message - Message to display
 * @param duration - How long to show (0 = until clicked, default: 0)
 */
function showClipboardNotification(text: string, message: string, duration = 0): void {
  // Clear any existing notification
  hideClipboardNotification();

  pendingClipboardText = text;

  // Create notification element
  notificationElement = document.createElement('div');
  notificationElement.className = 'tui-clipboard-notification';
  notificationElement.innerHTML = `
    <span class="tui-clipboard-icon">📋</span>
    <span class="tui-clipboard-message">${escapeHtml(message)}</span>
    <span class="tui-clipboard-preview">${escapeHtml(truncateText(text, 30))}</span>
  `;

  // Style the notification
  Object.assign(notificationElement.style, {
    position: 'fixed',
    bottom: '80px',
    right: '20px',
    padding: '12px 16px',
    background: 'rgba(30, 30, 30, 0.95)',
    border: '1px solid #444',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    zIndex: '10000',
    cursor: duration === 0 ? 'pointer' : 'default',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    transition: 'opacity 0.2s ease',
    maxWidth: '300px'
  });

  document.body.appendChild(notificationElement);

  // Click to copy (for deferred writes)
  if (duration === 0) {
    notificationElement.addEventListener('click', async () => {
      if (pendingClipboardText) {
        try {
          await navigator.clipboard.writeText(pendingClipboardText);
          // Update to success state
          if (notificationElement) {
            const msgEl = notificationElement.querySelector('.tui-clipboard-message');
            if (msgEl) {
              msgEl.textContent = 'Copied!';
            }
          }
          // Hide after brief success display
          setTimeout(hideClipboardNotification, 1000);
        } catch {
          // Still blocked - show error
          if (notificationElement) {
            const msgEl = notificationElement.querySelector('.tui-clipboard-message');
            if (msgEl) {
              msgEl.textContent = 'Copy failed';
            }
          }
        }
      }
    });
  }

  // Auto-hide after duration
  if (duration > 0) {
    notificationTimeout = setTimeout(hideClipboardNotification, duration);
  }
}

/**
 * Hide the clipboard notification
 */
function hideClipboardNotification(): void {
  if (notificationTimeout) {
    clearTimeout(notificationTimeout);
    notificationTimeout = null;
  }
  if (notificationElement) {
    notificationElement.remove();
    notificationElement = null;
  }
  pendingClipboardText = null;
}

/**
 * Escape HTML characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Truncate text with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3)}...`;
}
