/**
 * File Watcher Client
 *
 * WebSocket client for receiving file change notifications from the server.
 */

import type { ToolbarConfig } from './types.js';

/** File change event from server */
export interface FileChangeEvent {
  type: 'change';
  session: string;
  path: string;
  timestamp: number;
}

/** Client → Server message */
export type WatchMessage =
  | { action: 'watch'; session: string; path: string }
  | { action: 'unwatch'; session: string; path: string };

/** Connection state */
type ConnectionState = 'disconnected' | 'connecting' | 'connected';

export class FileWatcherClient {
  private config: ToolbarConfig;
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'disconnected';
  private changeListeners: Array<(event: FileChangeEvent) => void> = [];
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private watchedFiles: Set<string> = new Set();

  constructor(config: ToolbarConfig) {
    this.config = config;
  }

  /**
   * Connect to the file watcher WebSocket
   */
  connect(): void {
    if (this.state !== 'disconnected') {
      return;
    }

    this.state = 'connecting';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}${this.config.base_path}/api/preview/ws`;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.state = 'connected';
        this.reconnectAttempts = 0;

        // Re-subscribe to previously watched files
        for (const key of this.watchedFiles) {
          const [session, path] = key.split(':');
          if (session && path) {
            this.sendWatch(session, path);
          }
        }
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onclose = () => {
        this.state = 'disconnected';
        this.ws = null;
        this.scheduleReconnect();
      };

      this.ws.onerror = (_error) => {
        this.ws?.close();
      };
    } catch (_error) {
      this.state = 'disconnected';
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from the file watcher WebSocket
   */
  disconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.state = 'disconnected';
    this.watchedFiles.clear();
  }

  /**
   * Watch a file for changes
   */
  watch(session: string, path: string): void {
    const key = `${session}:${path}`;
    this.watchedFiles.add(key);

    if (this.state === 'connected') {
      this.sendWatch(session, path);
    } else if (this.state === 'disconnected') {
      this.connect();
    }
  }

  /**
   * Stop watching a file
   */
  unwatch(session: string, path: string): void {
    const key = `${session}:${path}`;
    this.watchedFiles.delete(key);

    if (this.state === 'connected') {
      this.sendUnwatch(session, path);
    }
  }

  /**
   * Stop watching all files
   */
  unwatchAll(): void {
    for (const key of this.watchedFiles) {
      const [session, path] = key.split(':');
      if (session && path && this.state === 'connected') {
        this.sendUnwatch(session, path);
      }
    }
    this.watchedFiles.clear();
  }

  /**
   * Register a file change listener
   */
  onFileChange(callback: (event: FileChangeEvent) => void): () => void {
    this.changeListeners.push(callback);
    return () => {
      const index = this.changeListeners.indexOf(callback);
      if (index !== -1) {
        this.changeListeners.splice(index, 1);
      }
    };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === 'connected';
  }

  /**
   * Get connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Send watch message
   */
  private sendWatch(session: string, path: string): void {
    const message: WatchMessage = { action: 'watch', session, path };
    this.send(message);
  }

  /**
   * Send unwatch message
   */
  private sendUnwatch(session: string, path: string): void {
    const message: WatchMessage = { action: 'unwatch', session, path };
    this.send(message);
  }

  /**
   * Send message to server
   */
  private send(message: WatchMessage): void {
    if (this.ws && this.state === 'connected') {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: string): void {
    try {
      const event = JSON.parse(data) as FileChangeEvent;

      if (event.type === 'change') {
        for (const listener of this.changeListeners) {
          try {
            listener(event);
          } catch (_error) {
            // Listener error - silently ignore
          }
        }
      }
    } catch (_error) {
      // Message parse error - silently ignore
    }
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    if (this.watchedFiles.size === 0) {
      // No files to watch, don't reconnect
      return;
    }

    const delay = this.reconnectDelay * 2 ** this.reconnectAttempts;
    this.reconnectAttempts++;

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}
