/**
 * Toolbar Client Entry Point
 *
 * Main application orchestrator that initializes and coordinates
 * all toolbar components.
 */

import { AutoRunManager } from './AutoRunManager.js';
import { ClipboardHistoryManager } from './ClipboardHistoryManager.js';
import { FileTransferManager } from './FileTransferManager.js';
import { FileWatcherClient } from './FileWatcherClient.js';
import { FontSizeManager } from './FontSizeManager.js';
import { InputHandler } from './InputHandler.js';
import { ModifierKeyState } from './ModifierKeyState.js';
import { NotificationManager } from './NotificationManager.js';
import { PreviewManager } from './PreviewManager.js';
import { PreviewPane } from './PreviewPane.js';
import { SearchManager } from './SearchManager.js';
import { ShareManager } from './ShareManager.js';
import { SmartPasteManager } from './SmartPasteManager.js';
import { SnippetManager } from './SnippetManager.js';
import { TerminalController } from './TerminalController.js';
import { TouchGestureHandler } from './TouchGestureHandler.js';
import { WebSocketConnection } from './WebSocketConnection.js';
import { toolbarEvents } from './events.js';
import type { SmartPasteElements, ToolbarConfig, ToolbarElements } from './types.js';
import { STORAGE_KEYS } from './types.js';
import { bindClick, isMobileDevice } from './utils.js';

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
  private previewPane: PreviewPane;
  private fileWatcher: FileWatcherClient;
  private preview: PreviewManager;

  private isMobile: boolean;

  constructor(config: ToolbarConfig) {
    this.config = config;
    this.isMobile = isMobileDevice();

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
    this.previewPane = new PreviewPane();
    this.fileWatcher = new FileWatcherClient(config);
    this.preview = new PreviewManager(config, {
      pane: this.previewPane,
      watcher: this.fileWatcher
    });
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
      previewBtn: document.getElementById('ttyd-toolbar-preview') as HTMLButtonElement,
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

    // Preview elements
    this.preview.bindElements(this.elements.previewBtn, {
      pane: document.getElementById('ttyd-preview-pane') as HTMLElement,
      header: document.getElementById('ttyd-preview-header') as HTMLElement,
      titleSpan: document.getElementById('ttyd-preview-title') as HTMLElement,
      refreshBtn: document.getElementById('ttyd-preview-refresh') as HTMLButtonElement,
      selectBtn: document.getElementById('ttyd-preview-select') as HTMLButtonElement,
      closeBtn: document.getElementById('ttyd-preview-close') as HTMLButtonElement,
      iframe: document.getElementById('ttyd-preview-iframe') as HTMLIFrameElement,
      resizer: document.getElementById('ttyd-preview-resizer') as HTMLElement
    });

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

    // Setup bell handler (emits 'notification:bell' via EventBus)
    setTimeout(() => {
      this.terminal.setupBellHandler();
    }, 1000);

    // Subscribe to EventBus events
    this.setupEventBusListeners();

    // Restore font size
    this.applyStoredFontSize();

    // Setup visibility change handler
    this.setupVisibilityHandler();

    // Auto-show on mobile
    if (this.isMobile) {
      setTimeout(() => this.toggleToolbar(true), 1000);
      setTimeout(() => this.showOnboarding(), 1500);
    }
  }

  /**
   * Setup all event listeners
   */
  private setupEventListeners(): void {
    const { elements } = this;

    // Send button
    bindClick(elements.sendBtn, () => this.submitInput());

    // Enter button
    bindClick(elements.enterBtn, () => this.input.sendEnter());

    // Run button
    bindClick(elements.runBtn, () => this.runInput());

    // Zoom buttons
    bindClick(elements.zoomInBtn, () => {
      this.terminal.zoomTerminal(2);
      toolbarEvents.emit('font:change', this.terminal.getCurrentFontSize());
    });

    bindClick(elements.zoomOutBtn, () => {
      this.terminal.zoomTerminal(-2);
      toolbarEvents.emit('font:change', this.terminal.getCurrentFontSize());
    });

    // Modifier buttons
    bindClick(elements.ctrlBtn, () => this.modifiers.toggle('ctrl'));
    bindClick(elements.altBtn, () => this.modifiers.toggle('alt'));
    bindClick(elements.shiftBtn, () => this.modifiers.toggle('shift'));

    // Auto-run button
    bindClick(elements.autoBtn, () => this.autoRun.toggle());

    // Special key buttons
    bindClick(elements.escBtn, () => this.input.sendEsc());
    bindClick(elements.tabBtn, () => this.input.sendTab());
    bindClick(elements.upBtn, () => this.input.sendArrow('up'));
    bindClick(elements.downBtn, () => this.input.sendArrow('down'));

    bindClick(elements.pageUpBtn, () => this.input.sendPage('up'));
    bindClick(elements.pageDownBtn, () => this.input.sendPage('down'));

    // Copy buttons
    bindClick(elements.copyBtn, () => this.terminal.copySelection());
    bindClick(elements.copyAllBtn, () => this.terminal.copyAll());

    // Paste button - uses smart paste for text/image detection
    bindClick(elements.pasteBtn, () => {
      // Don't paste if this was a long press (history popup shown)
      if (this.clipboardHistory.isLongPressInProgress()) {
        return;
      }
      // Use smart paste to detect content type (text vs image)
      this.smartPaste.smartPaste();
    });

    // Scroll button
    bindClick(elements.scrollBtn, () => this.touch.toggleScrollMode());

    // Notification button
    bindClick(elements.notifyBtn, () => this.notifications.toggle());

    // Minimize button
    bindClick(elements.minimizeBtn, () => {
      elements.container.classList.toggle('minimized');
      elements.minimizeBtn.textContent = elements.container.classList.contains('minimized')
        ? '\u25B2'
        : '\u25BC'; // ▲ : ▼
      setTimeout(() => this.terminal.fitTerminal(), 100);
    });

    // Toggle button
    bindClick(elements.toggleBtn, () => this.toggleToolbar());

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

    bindClick(elements.searchToolbarBtn, () => this.search.toggle());
    bindClick(elements.searchCloseBtn, () => this.search.toggle(false));
    bindClick(elements.searchNextBtn, () => this.search.findNext());
    bindClick(elements.searchPrevBtn, () => this.search.findPrevious());
    bindClick(elements.searchCaseBtn, () => this.search.toggleCaseSensitive());
    bindClick(elements.searchRegexBtn, () => this.search.toggleRegex());

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
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  }

  /**
   * Submit input text to terminal
   */
  private submitInput(): void {
    const text = this.elements.input.value;
    if (!text) {
      return;
    }

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
    if (!text) {
      return;
    }

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
      }
    };

    // Try multiple times as terminal may not be ready
    setTimeout(applySize, 500);
    setTimeout(applySize, 1500);
  }

  /**
   * Setup EventBus listeners for inter-manager communication
   */
  private setupEventBusListeners(): void {
    // Listen for bell events
    toolbarEvents.on('notification:bell', () => {});

    // Listen for font change events
    toolbarEvents.on('font:change', (size) => {
      this.fontSizeManager.save(size);
    });

    // Listen for error events
    toolbarEvents.on('error', (_error) => {});

    // Listen for preview file select events
    document.addEventListener('ttyd-preview-select', ((e: CustomEvent) => {
      const callback = e.detail?.callback as ((path: string) => void) | undefined;
      if (callback) {
        this.fileTransfer.openForPreview(callback);
      }
    }) as EventListener);
  }

  /**
   * Setup visibility change handler for auto-reload
   */
  private setupVisibilityHandler(): void {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        if (!this.ws.isConnected()) {
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
    if (!onboarding) {
      return;
    }

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
}
