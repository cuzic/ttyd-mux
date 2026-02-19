/**
 * Toolbar Client Type Definitions
 *
 * Types for the browser-side toolbar implementation.
 */

/** Terminal interface (subset of xterm.js Terminal) */
export interface Terminal {
  options: {
    fontSize?: number;
  };
  element?: HTMLElement;
  buffer: {
    active: TerminalBuffer;
  };
  getSelection(): string;
  loadAddon(addon: unknown): void;
  onBell(callback: () => void): void;
}

/** Terminal buffer interface */
export interface TerminalBuffer {
  length: number;
  getLine(index: number): TerminalLine | undefined;
}

/** Terminal line interface */
export interface TerminalLine {
  translateToString(trimRight?: boolean): string;
}

/** Search addon interface */
export interface SearchAddon {
  findNext(term: string, options?: SearchOptions): boolean;
  findPrevious(term: string, options?: SearchOptions): boolean;
  clearDecorations?(): void;
}

/** Search options */
export interface SearchOptions {
  caseSensitive?: boolean;
  regex?: boolean;
  incremental?: boolean;
}

/** Fit addon interface */
export interface FitAddon {
  fit(): void;
}

/** Toolbar configuration from server */
export interface ToolbarConfig {
  font_size_min: number;
  font_size_max: number;
  font_size_default_mobile: number;
  font_size_default_pc: number;
  double_tap_delay: number;
}

/** DOM element IDs for toolbar */
export interface ToolbarElements {
  container: HTMLElement;
  input: HTMLTextAreaElement;
  sendBtn: HTMLButtonElement;
  enterBtn: HTMLButtonElement;
  zoomInBtn: HTMLButtonElement;
  zoomOutBtn: HTMLButtonElement;
  runBtn: HTMLButtonElement;
  toggleBtn: HTMLButtonElement;
  ctrlBtn: HTMLButtonElement;
  altBtn: HTMLButtonElement;
  shiftBtn: HTMLButtonElement;
  escBtn: HTMLButtonElement;
  tabBtn: HTMLButtonElement;
  upBtn: HTMLButtonElement;
  downBtn: HTMLButtonElement;
  copyBtn: HTMLButtonElement;
  copyAllBtn: HTMLButtonElement;
  autoBtn: HTMLButtonElement;
  minimizeBtn: HTMLButtonElement;
  scrollBtn: HTMLButtonElement;
  pageUpBtn: HTMLButtonElement;
  pageDownBtn: HTMLButtonElement;
  notifyBtn: HTMLButtonElement;
  // Search bar elements
  searchBar: HTMLElement;
  searchInput: HTMLInputElement;
  searchCount: HTMLElement;
  searchPrevBtn: HTMLButtonElement;
  searchNextBtn: HTMLButtonElement;
  searchCaseBtn: HTMLButtonElement;
  searchRegexBtn: HTMLButtonElement;
  searchCloseBtn: HTMLButtonElement;
  searchToolbarBtn: HTMLButtonElement;
}

/** localStorage keys */
export const STORAGE_KEYS = {
  FONT_SIZE: 'ttyd-toolbar-font-size',
  ONBOARDING_SHOWN: 'ttyd-toolbar-onboarding-shown',
  AUTO_RUN: 'ttyd-toolbar-auto-run',
  NOTIFY_SUBSCRIPTION: 'ttyd-mux-notify-subscription',
} as const;

/** Declare global window extensions */
declare global {
  interface Window {
    __TOOLBAR_CONFIG__: ToolbarConfig;
    term?: Terminal;
    socket?: WebSocket;
    fitAddon?: FitAddon;
    SearchAddon?: {
      SearchAddon: new () => SearchAddon;
    };
  }
}
