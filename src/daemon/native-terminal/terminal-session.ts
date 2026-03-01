/**
 * TerminalSession - Manages a single PTY session using Bun.Terminal
 *
 * This class wraps Bun's built-in Terminal API to provide:
 * - PTY lifecycle management
 * - Multi-client broadcasting
 * - Output buffering for AI features
 * - WebSocket protocol handling
 */

import {
  type NativeTerminalWebSocket,
  type ServerMessage,
  type TerminalSessionInfo,
  type TerminalSessionOptions,
  createBellMessage,
  createExitMessage,
  createOutputMessage,
  createPongMessage,
  parseClientMessage,
  serializeServerMessage,
} from './types.js';

// Bell character (ASCII 7)
const BELL_CHAR = 0x07;

const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;
const DEFAULT_OUTPUT_BUFFER_SIZE = 1000;

// Bun.Terminal type (not exported by Bun types yet)
interface BunTerminal {
  write(data: string | Uint8Array): void;
  resize(cols: number, rows: number): void;
  close(): void;
  closed: boolean;
}

export class TerminalSession {
  private proc: ReturnType<typeof Bun.spawn> | null = null;
  private terminal: BunTerminal | null = null;
  private clients: Set<NativeTerminalWebSocket> = new Set();
  private outputBuffer: string[] = [];
  private readonly maxOutputBuffer: number;
  private readonly startedAt: string;
  private currentCols: number;
  private currentRows: number;
  private exitCode: number | null = null;

  readonly name: string;
  readonly cwd: string;
  readonly command: string[];

  constructor(private readonly options: TerminalSessionOptions) {
    this.name = options.name;
    this.cwd = options.cwd;
    this.command = options.command;
    this.currentCols = options.cols ?? DEFAULT_COLS;
    this.currentRows = options.rows ?? DEFAULT_ROWS;
    this.maxOutputBuffer = options.outputBufferSize ?? DEFAULT_OUTPUT_BUFFER_SIZE;
    this.startedAt = new Date().toISOString();
  }

  /**
   * Start the PTY process
   */
  async start(): Promise<void> {
    if (this.proc) {
      throw new Error(`Session ${this.name} is already running`);
    }

    // Use Bun.Terminal for PTY management
    this.proc = Bun.spawn(this.command, {
      cwd: this.cwd,
      env: {
        ...process.env,
        ...this.options.env,
        TERM: 'xterm-256color',
      },
      terminal: {
        cols: this.currentCols,
        rows: this.currentRows,
        data: (_terminal: BunTerminal, data: Uint8Array) => {
          this.handleOutput(data);
        },
        exit: (_terminal: BunTerminal, code: number) => {
          console.log(`[TerminalSession:${this.name}] Terminal exit callback: ${code}`);
        },
      },
    });

    // Get terminal reference
    // biome-ignore lint/suspicious/noExplicitAny: Bun.Terminal type not fully exported
    this.terminal = (this.proc as any).terminal as BunTerminal;

    console.log(`[TerminalSession:${this.name}] Started PTY with PID: ${this.proc.pid}`);

    // Handle process exit
    this.proc.exited.then((code) => {
      console.log(`[TerminalSession:${this.name}] Process exited: code=${code}`);
      this.exitCode = code;
      this.broadcast(createExitMessage(code));
      this.cleanup();
    });
  }

  /**
   * Handle output data from PTY
   */
  private handleOutput(data: Uint8Array): void {
    const message = createOutputMessage(data);
    const serialized = serializeServerMessage(message);

    // Check for bell character and send bell message
    if (data.includes(BELL_CHAR)) {
      this.broadcast(createBellMessage());
    }

    // Buffer for AI features
    this.outputBuffer.push(message.data);
    if (this.outputBuffer.length > this.maxOutputBuffer) {
      this.outputBuffer.shift();
    }

    // Broadcast to all clients
    for (const ws of this.clients) {
      try {
        ws.send(serialized);
      } catch (error) {
        console.error(`[TerminalSession:${this.name}] Send error:`, error);
      }
    }
  }

  /**
   * Broadcast a message to all connected clients
   */
  private broadcast(message: ServerMessage): void {
    const serialized = serializeServerMessage(message);
    for (const ws of this.clients) {
      try {
        ws.send(serialized);
      } catch {
        // Client disconnected
      }
    }
  }

  /**
   * Write data to the PTY
   */
  write(data: string): void {
    if (this.terminal && !this.terminal.closed) {
      this.terminal.write(data);
    }
  }

  /**
   * Resize the PTY
   */
  resize(cols: number, rows: number): void {
    if (cols <= 0 || rows <= 0) return;

    this.currentCols = cols;
    this.currentRows = rows;

    if (this.terminal && !this.terminal.closed && this.isRunning) {
      try {
        this.terminal.resize(cols, rows);
      } catch (error) {
        console.error(`[TerminalSession:${this.name}] Resize failed:`, error);
      }
    }
  }

  /**
   * Handle an incoming WebSocket message
   */
  handleMessage(ws: NativeTerminalWebSocket, data: string): void {
    const message = parseClientMessage(data);
    if (!message) {
      ws.send(serializeServerMessage({ type: 'error', message: 'Invalid message format' }));
      return;
    }

    switch (message.type) {
      case 'input':
        this.write(message.data);
        break;
      case 'resize':
        this.resize(message.cols, message.rows);
        break;
      case 'ping':
        ws.send(serializeServerMessage(createPongMessage()));
        break;
    }
  }

  /**
   * Add a client WebSocket connection
   */
  addClient(ws: NativeTerminalWebSocket): void {
    this.clients.add(ws);

    // Send buffered output to new client (for session reconnection)
    if (this.outputBuffer.length > 0) {
      // Send last N lines of buffer
      const replayCount = Math.min(this.outputBuffer.length, 100);
      const replay = this.outputBuffer.slice(-replayCount);
      for (const data of replay) {
        try {
          ws.send(serializeServerMessage({ type: 'output', data }));
        } catch {
          break;
        }
      }
    }
  }

  /**
   * Remove a client WebSocket connection
   */
  removeClient(ws: NativeTerminalWebSocket): void {
    this.clients.delete(ws);
  }

  /**
   * Get the number of connected clients
   */
  get clientCount(): number {
    return this.clients.size;
  }

  /**
   * Check if the session is still running
   */
  get isRunning(): boolean {
    return this.proc !== null && this.exitCode === null;
  }

  /**
   * Get the process ID
   */
  get pid(): number | undefined {
    return this.proc?.pid;
  }

  /**
   * Get session info
   */
  getInfo(): TerminalSessionInfo {
    return {
      name: this.name,
      pid: this.proc?.pid ?? 0,
      cwd: this.cwd,
      cols: this.currentCols,
      rows: this.currentRows,
      clientCount: this.clients.size,
      startedAt: this.startedAt,
    };
  }

  /**
   * Get buffered output for AI features
   */
  getOutputBuffer(): string[] {
    return [...this.outputBuffer];
  }

  /**
   * Clear the output buffer
   */
  clearOutputBuffer(): void {
    this.outputBuffer = [];
  }

  /**
   * Stop the session
   */
  async stop(): Promise<void> {
    this.cleanup();

    if (this.terminal && !this.terminal.closed) {
      this.terminal.close();
    }

    if (this.proc) {
      try {
        this.proc.kill();
        // Wait a bit for process to exit
        await Promise.race([
          this.proc.exited,
          new Promise((resolve) => setTimeout(resolve, 1000)),
        ]);
      } catch {
        // Process may already be dead
      }
      this.proc = null;
      this.terminal = null;
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    // Close all client connections
    for (const ws of this.clients) {
      try {
        ws.close(1000, 'Session ended');
      } catch {
        // Already closed
      }
    }
    this.clients.clear();
  }
}
