/**
 * Toolbar Client Entry Point
 *
 * Main application orchestrator that initializes and coordinates
 * all toolbar components.
 */

import { AutoRunManager } from './AutoRunManager.js';
import { ClipboardHistoryManager } from './ClipboardHistoryManager.js';
import { FileTransferManager } from './FileTransferManager.js';
import { FontSizeManager } from './FontSizeManager.js';
import { InputHandler } from './InputHandler.js';
import { ModifierKeyState } from './ModifierKeyState.js';
import { NotificationManager } from './NotificationManager.js';
import { SearchManager } from './SearchManager.js';
import { ShareManager } from './ShareManager.js';
import { SmartPasteManager } from './SmartPasteManager.js';
import { SnippetManager } from './SnippetManager.js';
import { TerminalController } from './TerminalController.js';
import { TouchGestureHandler } from './TouchGestureHandler.js';
import { WebSocketConnection } from './WebSocketConnection.js';
import type { SmartPasteElements, ToolbarConfig, ToolbarElements } from './types.js';
import { STORAGE_KEYS } from './types.js';

class ToolbarApp {
  private config: ToolbarConfig;
  private elements: ToolbarElements;

  private ws: WebSocketConnection;
  private terminal: TerminalController;
  private modifiers: ModifierKeyState;
  private input: InputHandler;
  private search: SearchManager;
  private notifications: NotificationManager;
  private share: ShareManager;
  private snippet: SnippetManager;
  private clipboardHistory: ClipboardHistoryManager;
  private fileTransfer: FileTransferManager;
  private smartPaste: SmartPasteManager;
  private touch: TouchGestureHandler;
  private fontSizeManager: FontSizeManager;
  private autoRun: AutoRunManager;

  private isMobile: boolean;

  constructor(config: ToolbarConfig) {
    this.config = config;
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

    // Get DOM elements
    this.elements = this.getElements();

    // Initialize components
    this.ws = new WebSocketConnection();
    this.terminal = new TerminalController(config);
    this.modifiers = new ModifierKeyState();
    this.input = new InputHandler(this.ws, this.modifiers);
    this.search = new SearchManager(() => this.terminal.findTerminal());
    this.notifications = new NotificationManager(config);
    this.snippet = new SnippetManager(this.input);
    this.clipboardHistory = new ClipboardHistoryManager(this.input);
    this.fileTransfer = new FileTransferManager(config);
    this.smartPaste = new SmartPasteManager(config, this.input, this.clipboardHistory);
    this.touch = new TouchGestureHandler(config, this.terminal, this.input, this.modifiers);
    this.fontSizeManager = new FontSizeManager(config);
    this.autoRun = new AutoRunManager();
  }

  /**
   * Get all toolbar DOM elements
   */
  private getElements(): ToolbarElements {
    return {
      container: document.getElementById('ttyd-toolbar') as HTMLElement,
      input: document.getElementById('ttyd-toolbar-input') as HTMLTextAreaElement,
      sendBtn: document.getElementById('ttyd-toolbar-send') as HTMLButtonElement,
      enterBtn: document.getElementById('ttyd-toolbar-enter') as HTMLButtonElement,
      zoomInBtn: document.getElementById('ttyd-toolbar-zoomin') as HTMLButtonElement,
      zoomOutBtn: document.getElementById('ttyd-toolbar-zoomout') as HTMLButtonElement,
      runBtn: document.getElementById('ttyd-toolbar-run') as HTMLButtonElement,
      toggleBtn: document.getElementById('ttyd-toolbar-toggle') as HTMLButtonElement,
      ctrlBtn: document.getElementById('ttyd-toolbar-ctrl') as HTMLButtonElement,
      altBtn: document.getElementById('ttyd-toolbar-alt') as HTMLButtonElement,
      shiftBtn: document.getElementById('ttyd-toolbar-shift') as HTMLButtonElement,
      escBtn: document.getElementById('ttyd-toolbar-esc') as HTMLButtonElement,
      tabBtn: document.getElementById('ttyd-toolbar-tab') as HTMLButtonElement,
      upBtn: document.getElementById('ttyd-toolbar-up') as HTMLButtonElement,
      downBtn: document.getElementById('ttyd-toolbar-down') as HTMLButtonElement,
      copyBtn: document.getElementById('ttyd-toolbar-copy') as HTMLButtonElement,
      copyAllBtn: document.getElementById('ttyd-toolbar-copyall') as HTMLButtonElement,
      pasteBtn: document.getElementById('ttyd-toolbar-paste') as HTMLButtonElement,
      autoBtn: document.getElementById('ttyd-toolbar-auto') as HTMLButtonElement,
      minimizeBtn: document.getElementById('ttyd-toolbar-minimize') as HTMLButtonElement,
      scrollBtn: document.getElementById('ttyd-toolbar-scroll') as HTMLButtonElement,
      pageUpBtn: document.getElementById('ttyd-toolbar-pageup') as HTMLButtonElement,
      pageDownBtn: document.getElementById('ttyd-toolbar-pagedown') as HTMLButtonElement,
      notifyBtn: document.getElementById('ttyd-toolbar-notify') as HTMLButtonElement,
      shareBtn: document.getElementById('ttyd-toolbar-share') as HTMLButtonElement,
      snippetBtn: document.getElementById('ttyd-toolbar-snippet') as HTMLButtonElement,
      downloadBtn: document.getElementById('ttyd-toolbar-download') as HTMLButtonElement,
      uploadBtn: document.getElementById('ttyd-toolbar-upload') as HTMLButtonElement,
      // Share modal elements
      shareModal: document.getElementById('ttyd-share-modal') as HTMLElement,
      shareModalClose: document.getElementById('ttyd-share-modal-close') as HTMLButtonElement,
      shareCreate: document.getElementById('ttyd-share-create') as HTMLButtonElement,
      shareResult: document.getElementById('ttyd-share-result') as HTMLElement,
      shareUrl: document.getElementById('ttyd-share-url') as HTMLInputElement,
      shareCopy: document.getElementById('ttyd-share-copy') as HTMLButtonElement,
      shareQr: document.getElementById('ttyd-share-qr') as HTMLButtonElement,
      // Search bar elements
      searchBar: document.getElementById('ttyd-search-bar') as HTMLElement,
      searchInput: document.getElementById('ttyd-search-input') as HTMLInputElement,
      searchCount: document.getElementById('ttyd-search-count') as HTMLElement,
      searchPrevBtn: document.getElementById('ttyd-search-prev') as HTMLButtonElement,
      searchNextBtn: document.getElementById('ttyd-search-next') as HTMLButtonElement,
      searchCaseBtn: document.getElementById('ttyd-search-case') as HTMLButtonElement,
      searchRegexBtn: document.getElementById('ttyd-search-regex') as HTMLButtonElement,
      searchCloseBtn: document.getElementById('ttyd-search-close') as HTMLButtonElement,
      searchToolbarBtn: document.getElementById('ttyd-toolbar-search') as HTMLButtonElement
    };
  }

  /**
   * Initialize the toolbar application
   */
  initialize(): void {
    // Bind component elements
    this.modifiers.bindElements(
      this.elements.ctrlBtn,
      this.elements.altBtn,
      this.elements.shiftBtn
    );

    this.search.bindElements(
      this.elements.searchBar,
      this.elements.searchInput,
      this.elements.searchCount,
      this.elements.searchCaseBtn,
      this.elements.searchRegexBtn
    );

    this.notifications.bindElement(this.elements.notifyBtn);

    this.share = new ShareManager(this.config);
    this.share.bindElements(
      this.elements.shareBtn,
      this.elements.shareModal,
      this.elements.shareModalClose,
      this.elements.shareCreate,
      this.elements.shareResult,
      this.elements.shareUrl,
      this.elements.shareCopy,
      this.elements.shareQr
    );

    this.snippet.bindElements(
      this.elements.snippetBtn,
      document.getElementById('ttyd-snippet-modal') as HTMLElement,
      document.getElementById('ttyd-snippet-modal-close') as HTMLButtonElement,
      document.getElementById('ttyd-snippet-add') as HTMLButtonElement,
      document.getElementById('ttyd-snippet-import') as HTMLButtonElement,
      document.getElementById('ttyd-snippet-export') as HTMLButtonElement,
      document.getElementById('ttyd-snippet-search') as HTMLInputElement,
      document.getElementById('ttyd-snippet-list') as HTMLElement,
      document.getElementById('ttyd-snippet-add-form') as HTMLElement,
      document.getElementById('ttyd-snippet-add-name') as HTMLInputElement,
      document.getElementById('ttyd-snippet-add-command') as HTMLTextAreaElement,
      document.getElementById('ttyd-snippet-add-save') as HTMLButtonElement,
      document.getElementById('ttyd-snippet-add-cancel') as HTMLButtonElement
    );

    this.fileTransfer.bindElements(
      this.elements.downloadBtn,
      this.elements.uploadBtn,
      document.getElementById('ttyd-file-modal') as HTMLElement,
      document.getElementById('ttyd-file-modal-close') as HTMLButtonElement,
      document.getElementById('ttyd-file-modal-title') as HTMLElement,
      document.getElementById('ttyd-file-list') as HTMLElement,
      document.getElementById('ttyd-file-breadcrumb') as HTMLElement,
      document.getElementById('ttyd-file-upload-input') as HTMLInputElement,
      document.getElementById('ttyd-file-upload-btn') as HTMLButtonElement
    );

    this.touch.bindScrollButton(this.elements.scrollBtn);
    this.autoRun.bindElement(this.elements.autoBtn);
    this.clipboardHistory.bindPasteButton(this.elements.pasteBtn);

    // Smart paste elements
    const smartPasteElements: SmartPasteElements = {
      previewModal: document.getElementById('ttyd-image-preview-modal') as HTMLElement,
      previewClose: document.getElementById('ttyd-image-preview-close') as HTMLButtonElement,
      previewImg: document.getElementById('ttyd-image-preview-img') as HTMLImageElement,
      previewPrev: document.getElementById('ttyd-image-preview-prev') as HTMLButtonElement,
      previewNext: document.getElementById('ttyd-image-preview-next') as HTMLButtonElement,
      previewCounter: document.getElementById('ttyd-image-preview-counter') as HTMLElement,
      previewDots: document.getElementById('ttyd-image-preview-dots') as HTMLElement,
      previewRemove: document.getElementById('ttyd-image-preview-remove') as HTMLButtonElement,
      previewCancel: document.getElementById('ttyd-image-preview-cancel') as HTMLButtonElement,
      previewSubmit: document.getElementById('ttyd-image-preview-submit') as HTMLButtonElement,
      dropZone: document.getElementById('ttyd-drop-zone') as HTMLElement
    };
    this.smartPaste.bindElements(smartPasteElements);

    // Setup event listeners
    this.setupEventListeners();

    // Setup touch gestures
    this.touch.setup();

    // Setup bell handler
    setTimeout(() => {
      this.terminal.setupBellHandler(() => {
        // Visual feedback handled inside setupBellHandler
      });
    }, 1000);

    // Restore font size
    this.applyStoredFontSize();

    // Setup visibility change handler
    this.setupVisibilityHandler();

    // Auto-show on mobile
    if (this.isMobile) {
      setTimeout(() => this.toggleToolbar(true), 1000);
      setTimeout(() => this.showOnboarding(), 1500);
    }

    console.log(
      '[Toolbar] Loaded. ' +
        (this.isMobile ? 'Mobile mode.' : 'Press Ctrl+J or click keyboard button to toggle.')
    );
  }

  /**
   * Setup all event listeners
   */
  private setupEventListeners(): void {
    const { elements } = this;

    // Send button
    elements.sendBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.submitInput();
    });

    // Enter button
    elements.enterBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.input.sendEnter();
    });

    // Run button
    elements.runBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.runInput();
    });

    // Zoom buttons
    elements.zoomInBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.terminal.zoomTerminal(2);
      this.fontSizeManager.save(this.terminal.getCurrentFontSize());
    });

    elements.zoomOutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.terminal.zoomTerminal(-2);
      this.fontSizeManager.save(this.terminal.getCurrentFontSize());
    });

    // Modifier buttons
    elements.ctrlBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.modifiers.toggle('ctrl');
    });

    elements.altBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.modifiers.toggle('alt');
    });

    elements.shiftBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.modifiers.toggle('shift');
    });

    // Auto-run button
    elements.autoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.autoRun.toggle();
    });

    // Special key buttons
    elements.escBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.input.sendEsc();
    });

    elements.tabBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.input.sendTab();
    });

    elements.upBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.input.sendArrow('up');
    });

    elements.downBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.input.sendArrow('down');
    });

    elements.pageUpBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.input.sendPage('up');
    });

    elements.pageDownBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.input.sendPage('down');
    });

    // Copy buttons
    elements.copyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.terminal.copySelection();
    });

    elements.copyAllBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.terminal.copyAll();
    });

    // Paste button - uses smart paste for text/image detection
    elements.pasteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // Don't paste if this was a long press (history popup shown)
      if (this.clipboardHistory.isLongPressInProgress()) {
        return;
      }
      // Use smart paste to detect content type (text vs image)
      this.smartPaste.smartPaste();
    });

    // Scroll button
    elements.scrollBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.touch.toggleScrollMode();
    });

    // Notification button
    elements.notifyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.notifications.toggle();
    });

    // Minimize button
    elements.minimizeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      elements.container.classList.toggle('minimized');
      elements.minimizeBtn.textContent = elements.container.classList.contains('minimized')
        ? '\u25B2'
        : '\u25BC'; // ▲ : ▼
      setTimeout(() => this.terminal.fitTerminal(), 100);
    });

    // Toggle button
    elements.toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleToolbar();
    });

    // Search bar events
    this.setupSearchEvents();

    // Input textarea events
    this.setupInputEvents();

    // Global keyboard shortcuts
    this.setupKeyboardShortcuts();
  }

  /**
   * Setup search bar event listeners
   */
  private setupSearchEvents(): void {
    const { elements } = this;

    elements.searchToolbarBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.search.toggle();
    });

    elements.searchCloseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.search.toggle(false);
    });

    elements.searchNextBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.search.findNext();
    });

    elements.searchPrevBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.search.findPrevious();
    });

    elements.searchCaseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.search.toggleCaseSensitive();
    });

    elements.searchRegexBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.search.toggleRegex();
    });

    elements.searchInput.addEventListener('input', () => {
      this.search.doSearch();
    });

    elements.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !(e as KeyboardEvent & { isComposing: boolean }).isComposing) {
        e.preventDefault();
        if (e.shiftKey) {
          this.search.findPrevious();
        } else {
          this.search.findNext();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.search.toggle(false);
      } else if (e.key === 'F3') {
        e.preventDefault();
        if (e.shiftKey) {
          this.search.findPrevious();
        } else {
          this.search.findNext();
        }
      }
    });
  }

  /**
   * Setup input textarea event listeners
   */
  private setupInputEvents(): void {
    const { input } = this.elements;

    input.addEventListener('input', () => this.adjustTextareaHeight());

    input.addEventListener('keydown', (e) => {
      if (
        e.key === 'Enter' &&
        !e.shiftKey &&
        !(e as KeyboardEvent & { isComposing: boolean }).isComposing
      ) {
        e.preventDefault();
        this.submitInput();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.toggleToolbar(false);
      }
    });
  }

  /**
   * Setup global keyboard shortcuts
   */
  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      // Ctrl+J to toggle toolbar
      if (e.ctrlKey && e.key === 'j') {
        e.preventDefault();
        this.toggleToolbar();
      }
      // Ctrl+Shift+F to toggle search bar
      if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        this.search.toggle();
      }
      // Ctrl+Shift+V for smart paste (image-aware paste)
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        this.smartPaste.smartPaste();
      }
    });
  }

  /**
   * Adjust textarea height based on content
   */
  private adjustTextareaHeight(): void {
    const input = this.elements.input;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  }

  /**
   * Submit input text to terminal
   */
  private submitInput(): void {
    const text = this.elements.input.value;
    if (!text) return;

    if (this.input.sendText(text)) {
      this.elements.input.value = '';
      this.adjustTextareaHeight();

      // Auto mode: send Enter after 1 second
      if (this.autoRun.isActive()) {
        setTimeout(() => this.input.sendEnter(), 1000);
      }
    }
  }

  /**
   * Run input (send text + Enter after delay)
   */
  private runInput(): void {
    const text = this.elements.input.value;
    if (!text) return;

    if (this.input.sendText(text)) {
      this.elements.input.value = '';
      this.adjustTextareaHeight();
      // Wait 1 second then send Enter
      setTimeout(() => this.input.sendEnter(), 1000);
    }
  }

  /**
   * Toggle toolbar visibility
   */
  private toggleToolbar(show?: boolean): void {
    const { container, input } = this.elements;

    if (typeof show === 'boolean') {
      container.classList.toggle('hidden', !show);
    } else {
      container.classList.toggle('hidden');
    }

    if (container.classList.contains('hidden')) {
      const terminal = document.querySelector('.xterm-helper-textarea') as HTMLElement;
      terminal?.focus();
      setTimeout(() => this.terminal.fitTerminal(), 100);
    } else {
      input.focus();
      // Fit terminal after showing toolbar
      setTimeout(() => this.terminal.fitTerminal(), 100);
    }
  }

  /**
   * Apply stored font size from localStorage
   */
  private applyStoredFontSize(): void {
    const applySize = () => {
      const term = this.terminal.findTerminal();
      if (term?.options) {
        const storedSize = this.fontSizeManager.load();
        term.options.fontSize = storedSize;
        this.terminal.fitTerminal();
        console.log('[Toolbar] Restored font size: ' + storedSize);
      }
    };

    // Try multiple times as terminal may not be ready
    setTimeout(applySize, 500);
    setTimeout(applySize, 1500);
  }

  /**
   * Setup visibility change handler for auto-reload
   */
  private setupVisibilityHandler(): void {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        if (!this.ws.isConnected()) {
          console.log('[Toolbar] Connection lost, reloading...');
          location.reload();
        }
      }
    });
  }

  /**
   * Show onboarding tips for first-time users
   */
  private showOnboarding(): void {
    const onboarding = document.getElementById('ttyd-toolbar-onboarding');
    if (!onboarding) return;

    try {
      if (localStorage.getItem(STORAGE_KEYS.ONBOARDING_SHOWN)) {
        onboarding.remove();
        return;
      }
    } catch {
      // localStorage not available
    }

    // Show onboarding tooltip
    onboarding.style.display = 'block';

    const closeBtn = document.getElementById('ttyd-toolbar-onboarding-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        onboarding.remove();
        try {
          localStorage.setItem(STORAGE_KEYS.ONBOARDING_SHOWN, '1');
        } catch {
          // Ignore
        }
      });
    }

    // Auto-dismiss after 15 seconds
    setTimeout(() => {
      if (onboarding.parentNode) {
        onboarding.remove();
        try {
          localStorage.setItem(STORAGE_KEYS.ONBOARDING_SHOWN, '1');
        } catch {
          // Ignore
        }
      }
    }, 15000);
  }
}

// Initialize when DOM is ready
const config = window.__TOOLBAR_CONFIG__;
if (config) {
  const app = new ToolbarApp(config);
  app.initialize();
} else {
  console.error('[Toolbar] Configuration not found. Make sure __TOOLBAR_CONFIG__ is set.');
}
