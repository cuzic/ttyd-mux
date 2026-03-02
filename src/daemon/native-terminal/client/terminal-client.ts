/**
 * Terminal Client - Browser-side WebSocket handler for native terminal sessions
 *
 * This module handles:
 * - WebSocket connection to the server
 * - xterm.js initialization and event handling
 * - Protocol message encoding/decoding
 * - Reconnection logic
 */

import { type Block, BlockManager } from './BlockManager.js';
import { BlockRenderer } from './BlockRenderer.js';

declare global {
  interface Window {
    XtermBundle: typeof import('./xterm-bundle.js');
    TerminalClient: typeof TerminalClient;
    BlockManager: typeof BlockManager;
    BlockRenderer: typeof BlockRenderer;
    term: import('@xterm/xterm').Terminal | null;
    fitAddon: import('@xterm/addon-fit').FitAddon | null;
  }
}

interface TerminalClientOptions {
  /** WebSocket URL (e.g., ws://localhost:7680/ttyd-mux/session/ws) */
  wsUrl: string;
  /** Container element for the terminal */
  container: HTMLElement;
  /** Font size */
  fontSize?: number;
  /** Font family */
  fontFamily?: string;
  /** Scrollback buffer size */
  scrollback?: number;
  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean;
  /** Reconnect delay in ms */
  reconnectDelay?: number;
  /** Max reconnect attempts */
  maxReconnectAttempts?: number;
  /** Enable block UI */
  enableBlockUI?: boolean;
  /** Block UI event handlers */
  onBlockCopyCommand?: (command: string) => void;
  onBlockCopyOutput?: (output: string) => void;
  onBlockSendToAI?: (block: Block) => void;
}

interface ClientMessage {
  type: 'input' | 'resize' | 'ping';
  data?: string;
  cols?: number;
  rows?: number;
}

interface ServerMessage {
  type:
    | 'output'
    | 'title'
    | 'exit'
    | 'pong'
    | 'error'
    | 'bell'
    | 'blockStart'
    | 'blockEnd'
    | 'blockOutput'
    | 'blockList';
  data?: string;
  title?: string;
  code?: number;
  message?: string;
  // Block-related fields
  block?: Block;
  blockId?: string;
  exitCode?: number;
  endedAt?: string;
  endLine?: number;
  blocks?: Block[];
}

export class TerminalClient {
  private ws: WebSocket | null = null;
  private terminal: import('@xterm/xterm').Terminal | null = null;
  private fitAddon: import('@xterm/addon-fit').FitAddon | null = null;
  private serializeAddon: import('@xterm/addon-serialize').SerializeAddon | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private pingInterval: number | null = null;
  private isClosing = false;

  // Block UI
  private blockManager: BlockManager | null = null;
  private blockRenderer: BlockRenderer | null = null;

  private readonly options: Required<TerminalClientOptions>;

  constructor(options: TerminalClientOptions) {
    this.options = {
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      scrollback: 10000,
      autoReconnect: true,
      reconnectDelay: 2000,
      maxReconnectAttempts: 5,
      enableBlockUI: true,
      onBlockCopyCommand: undefined as unknown as (command: string) => void,
      onBlockCopyOutput: undefined as unknown as (output: string) => void,
      onBlockSendToAI: undefined as unknown as (block: Block) => void,
      ...options
    };
  }

  /**
   * Initialize the terminal and connect to the server
   */
  async connect(): Promise<void> {
    // Check if XtermBundle is available
    if (!window.XtermBundle) {
      throw new Error('XtermBundle not loaded');
    }

    // Create terminal with addons
    const { terminal, fitAddon, serializeAddon } = window.XtermBundle.createTerminal({
      fontSize: this.options.fontSize,
      fontFamily: this.options.fontFamily,
      scrollback: this.options.scrollback
    });

    this.terminal = terminal;
    this.fitAddon = fitAddon;
    this.serializeAddon = serializeAddon;

    // Expose to window for debugging and terminal-ui.js access
    window.term = terminal;
    window.fitAddon = fitAddon;

    // Open terminal in container
    terminal.open(this.options.container);
    fitAddon.fit();

    // Handle terminal input
    terminal.onData((data) => {
      this.send({ type: 'input', data });
    });

    // Handle terminal resize
    terminal.onResize(({ cols, rows }) => {
      this.send({ type: 'resize', cols, rows });
    });

    // Handle window resize
    window.addEventListener('resize', () => {
      this.fit();
    });

    // Initialize Block UI if enabled
    if (this.options.enableBlockUI) {
      this.initBlockUI();
    }

    // Connect to WebSocket
    await this.connectWebSocket();
  }

  /**
   * Initialize the Block UI components
   */
  private initBlockUI(): void {
    // Create BlockManager with event handlers
    this.blockManager = new BlockManager({
      onBlockStart: (block) => {
        this.blockRenderer?.addBlock(block);
        // Update filter counts when a new block starts
        this.blockRenderer?.updateFilterState(
          this.blockManager?.getFilter() ?? 'all',
          this.blockManager?.getCounts() ?? { all: 0, success: 0, error: 0, running: 0 }
        );
      },
      onBlockEnd: (block) => {
        this.blockRenderer?.updateBlock(block);
        // Update filter counts when a block ends
        this.blockRenderer?.updateFilterState(
          this.blockManager?.getFilter() ?? 'all',
          this.blockManager?.getCounts() ?? { all: 0, success: 0, error: 0, running: 0 }
        );
      },
      onBlocksLoaded: (blocks) => {
        this.blockRenderer?.renderBlocks(blocks);
        // Update filter counts after loading blocks
        this.blockRenderer?.updateFilterState(
          this.blockManager?.getFilter() ?? 'all',
          this.blockManager?.getCounts() ?? { all: 0, success: 0, error: 0, running: 0 }
        );
      },
      onSelectionChange: (selectedIds) => {
        this.blockRenderer?.updateSelectionState(selectedIds);
      },
      onFilterChange: (filter, counts) => {
        this.blockRenderer?.updateFilterState(filter, counts);
      },
      onFocusChange: (blockId) => {
        this.blockRenderer?.updateFocusState(blockId);
      }
    });

    // Create BlockRenderer
    const terminalElement = this.options.container.querySelector('.xterm') as HTMLElement;
    if (terminalElement) {
      this.blockRenderer = new BlockRenderer({
        blockManager: this.blockManager,
        container: this.options.container,
        terminalElement,
        onCopyCommand: this.options.onBlockCopyCommand,
        onCopyOutput: this.options.onBlockCopyOutput,
        onSendToAI: this.options.onBlockSendToAI,
        onFilterBlock: (blockId) => {
          // Filter/search within block - can be implemented later
          console.log('[BlockUI] Filter in block:', blockId);
        },
        onRerunCommand: (command) => {
          // Send command to terminal with Enter
          this.sendInput(command + '\n');
        },
        onEditAndRerun: (command) => {
          // Send command to terminal without Enter (for editing)
          this.sendInput(command);
          this.focus();
        }
      });
    }
  }

  /**
   * Connect to the WebSocket server
   */
  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.options.wsUrl);

      this.ws.onopen = () => {
        console.log('[TerminalClient] Connected');
        this.reconnectAttempts = 0;

        // Send initial resize
        if (this.terminal) {
          this.send({
            type: 'resize',
            cols: this.terminal.cols,
            rows: this.terminal.rows
          });
        }

        // Start ping interval
        this.startPing();

        resolve();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.error('[TerminalClient] WebSocket error:', error);
        reject(error);
      };

      this.ws.onclose = (event) => {
        console.log('[TerminalClient] Disconnected:', event.code, event.reason);
        this.stopPing();

        if (!this.isClosing && this.options.autoReconnect) {
          this.scheduleReconnect();
        }
      };
    });
  }

  /**
   * Handle incoming server messages
   */
  private handleMessage(data: string): void {
    try {
      const message: ServerMessage = JSON.parse(data);

      switch (message.type) {
        case 'output':
          if (message.data && this.terminal) {
            // Decode Base64 data
            const bytes = Uint8Array.from(atob(message.data), (c) => c.charCodeAt(0));
            const decoder = new TextDecoder('utf-8', { fatal: false });
            this.terminal.write(decoder.decode(bytes));
          }
          break;

        case 'title':
          if (message.title) {
            document.title = message.title;
          }
          break;

        case 'exit':
          console.log('[TerminalClient] Session exited with code:', message.code);
          this.terminal?.write(`\r\n\x1b[31m[Session exited with code ${message.code}]\x1b[0m\r\n`);
          break;

        case 'pong':
          // Keep-alive response
          break;

        case 'error':
          console.error('[TerminalClient] Server error:', message.message);
          this.terminal?.write(`\r\n\x1b[31m[Error: ${message.message}]\x1b[0m\r\n`);
          break;

        case 'bell':
          // Trigger xterm.js bell (plays sound if configured, triggers onBell handlers)
          if (this.terminal) {
            // Write bell character to trigger xterm.js bell event
            this.terminal.write('\x07');
          }
          break;

        // Block UI messages
        case 'blockStart':
          if (message.block) {
            this.blockManager?.handleBlockStart(message.block);
          }
          break;

        case 'blockEnd':
          if (
            message.blockId &&
            message.exitCode !== undefined &&
            message.endedAt &&
            message.endLine !== undefined
          ) {
            this.blockManager?.handleBlockEnd(
              message.blockId,
              message.exitCode,
              message.endedAt,
              message.endLine
            );
          }
          break;

        case 'blockOutput':
          if (message.blockId && message.data) {
            this.blockManager?.handleBlockOutput(message.blockId, message.data);
          }
          break;

        case 'blockList':
          if (message.blocks) {
            this.blockManager?.handleBlockList(message.blocks);
          }
          break;
      }
    } catch (error) {
      console.error('[TerminalClient] Failed to parse message:', error);
    }
  }

  /**
   * Send a message to the server
   */
  private send(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Start ping interval for keep-alive
   */
  private startPing(): void {
    this.pingInterval = window.setInterval(() => {
      this.send({ type: 'ping' });
    }, 30000);
  }

  /**
   * Stop ping interval
   */
  private stopPing(): void {
    if (this.pingInterval !== null) {
      window.clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.log('[TerminalClient] Max reconnect attempts reached');
      this.terminal?.write(
        '\r\n\x1b[31m[Connection lost - max reconnect attempts reached]\x1b[0m\r\n'
      );
      return;
    }

    this.reconnectAttempts++;
    const delay = this.options.reconnectDelay * this.reconnectAttempts;

    console.log(`[TerminalClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.terminal?.write(
      `\r\n\x1b[33m[Reconnecting... attempt ${this.reconnectAttempts}]\x1b[0m\r\n`
    );

    this.reconnectTimer = window.setTimeout(async () => {
      try {
        await this.connectWebSocket();
      } catch {
        // Will trigger onclose and schedule another reconnect
      }
    }, delay);
  }

  /**
   * Fit terminal to container
   */
  fit(): void {
    this.fitAddon?.fit();
  }

  /**
   * Write data directly to the terminal (for local echo, etc.)
   */
  write(data: string): void {
    this.terminal?.write(data);
  }

  /**
   * Send input to the server (for toolbar input)
   * This sends the input through the WebSocket to the PTY
   */
  sendInput(data: string): void {
    this.send({ type: 'input', data });
  }

  /**
   * Get serialized terminal content (for AI features)
   */
  serialize(): string {
    return this.serializeAddon?.serialize() ?? '';
  }

  /**
   * Focus the terminal
   */
  focus(): void {
    this.terminal?.focus();
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    this.isClosing = true;

    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopPing();

    // Cleanup block UI
    this.blockRenderer?.dispose();
    this.blockRenderer = null;
    this.blockManager?.clear();
    this.blockManager = null;

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    if (this.terminal) {
      this.terminal.dispose();
      this.terminal = null;
    }

    window.term = null;
    window.fitAddon = null;
  }

  /**
   * Get the terminal instance
   */
  get term(): import('@xterm/xterm').Terminal | null {
    return this.terminal;
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get all blocks
   */
  getBlocks(): Block[] {
    return this.blockManager?.getAllBlocks() ?? [];
  }

  /**
   * Get the active (running) block
   */
  getActiveBlock(): Block | null {
    return this.blockManager?.getActiveBlock() ?? null;
  }

  /**
   * Toggle block UI visibility
   */
  toggleBlockUI(): void {
    this.blockRenderer?.toggle();
  }

  /**
   * Show/hide block UI
   */
  setBlockUIVisible(visible: boolean): void {
    this.blockRenderer?.setVisible(visible);
  }

  /**
   * Get decoded output for a specific block
   */
  getBlockOutput(blockId: string): string {
    return this.blockManager?.getDecodedOutput(blockId) ?? '';
  }
}

// Export for use by terminal-ui.js
window.TerminalClient = TerminalClient;
window.BlockManager = BlockManager;
window.BlockRenderer = BlockRenderer;
