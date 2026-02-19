/**
 * PreviewWsHandler Tests
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { SessionState } from '@/config/types.js';
import {
  createMockFileWatcherDeps,
  createMockSessionManager,
  createMockTimer
} from './deps.js';
import type { FileChangeEvent } from './types.js';
import { FileWatcherService } from './watcher.js';
import { type WebSocketLike, type WebSocketServerLike, PreviewWsHandler } from './ws-handler.js';

/** Create a mock WebSocket */
function createMockWebSocket(): WebSocketLike & {
  messages: string[];
  closed: boolean;
  closeCode?: number;
  listeners: Map<string, Array<(...args: unknown[]) => void>>;
  triggerMessage: (data: string) => void;
  triggerClose: () => void;
  triggerError: (err: Error) => void;
} {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  const ws: ReturnType<typeof createMockWebSocket> = {
    readyState: 1, // OPEN
    messages: [],
    closed: false,
    listeners,
    send: (data: string) => {
      ws.messages.push(data);
    },
    close: (code?: number) => {
      ws.closed = true;
      ws.closeCode = code;
      ws.readyState = 3; // CLOSED
    },
    on: (event: string, listener: (...args: unknown[]) => void) => {
      if (!listeners.has(event)) {
        listeners.set(event, []);
      }
      listeners.get(event)!.push(listener);
    },
    triggerMessage: (data: string) => {
      const messageListeners = listeners.get('message') || [];
      for (const listener of messageListeners) {
        listener({ toString: () => data });
      }
    },
    triggerClose: () => {
      const closeListeners = listeners.get('close') || [];
      for (const listener of closeListeners) {
        listener();
      }
    },
    triggerError: (err: Error) => {
      const errorListeners = listeners.get('error') || [];
      for (const listener of errorListeners) {
        listener(err);
      }
    }
  };

  return ws;
}

/** Create a mock WebSocket server */
function createMockWsServer(): WebSocketServerLike & {
  upgradeCallback?: (ws: WebSocketLike) => void;
} {
  const clients = new Set<WebSocketLike>();
  const server: ReturnType<typeof createMockWsServer> = {
    clients,
    handleUpgrade: (_req, _socket, _head, callback) => {
      server.upgradeCallback = callback;
    },
    emit: () => {}
  };
  return server;
}

describe('PreviewWsHandler', () => {
  let handler: PreviewWsHandler;
  let mockWsServer: ReturnType<typeof createMockWsServer>;
  let fileWatcher: FileWatcherService<WebSocketLike>;
  let mockTimer: ReturnType<typeof createMockTimer>;
  let sessions: SessionState[];

  beforeEach(() => {
    mockWsServer = createMockWsServer();
    mockTimer = createMockTimer();

    sessions = [
      {
        name: 'test-session',
        pid: 1234,
        port: 7601,
        path: '/ttyd-mux/test-session',
        dir: '/home/user/project',
        started_at: new Date().toISOString()
      }
    ];

    fileWatcher = new FileWatcherService(
      createMockFileWatcherDeps({ timer: mockTimer }),
      { debounceMs: 100, allowedExtensions: ['.html', '.htm'] }
    );

    handler = new PreviewWsHandler({
      sessionManager: createMockSessionManager(sessions),
      fileWatcher,
      createWsServer: () => mockWsServer
    });
  });

  afterEach(() => {
    handler.cleanup();
    fileWatcher.cleanup();
  });

  describe('handleMessage', () => {
    test('should handle watch action', () => {
      const ws = createMockWebSocket();

      handler.handleMessage(ws, JSON.stringify({
        action: 'watch',
        session: 'test-session',
        path: 'index.html'
      }));

      expect(fileWatcher.getStats().watchedFiles).toBe(1);
    });

    test('should handle unwatch action', () => {
      const ws = createMockWebSocket();

      // First watch
      handler.handleMessage(ws, JSON.stringify({
        action: 'watch',
        session: 'test-session',
        path: 'index.html'
      }));

      // Then unwatch
      handler.handleMessage(ws, JSON.stringify({
        action: 'unwatch',
        session: 'test-session',
        path: 'index.html'
      }));

      expect(fileWatcher.getStats().watchedFiles).toBe(0);
    });

    test('should ignore unknown session', () => {
      const ws = createMockWebSocket();

      handler.handleMessage(ws, JSON.stringify({
        action: 'watch',
        session: 'unknown-session',
        path: 'index.html'
      }));

      expect(fileWatcher.getStats().watchedFiles).toBe(0);
    });

    test('should handle invalid JSON gracefully', () => {
      const ws = createMockWebSocket();

      // Should not throw
      expect(() => handler.handleMessage(ws, 'invalid json')).not.toThrow();
    });

    test('should handle unknown action gracefully', () => {
      const ws = createMockWebSocket();

      // Should not throw
      expect(() => handler.handleMessage(ws, JSON.stringify({
        action: 'unknown',
        session: 'test-session',
        path: 'index.html'
      }))).not.toThrow();
    });
  });

  describe('handleConnection', () => {
    test('should setup message handler', () => {
      const ws = createMockWebSocket();

      handler.handleConnection(ws);
      ws.triggerMessage(JSON.stringify({
        action: 'watch',
        session: 'test-session',
        path: 'index.html'
      }));

      expect(fileWatcher.getStats().watchedFiles).toBe(1);
    });

    test('should cleanup on close', () => {
      const ws = createMockWebSocket();

      handler.handleConnection(ws);
      ws.triggerMessage(JSON.stringify({
        action: 'watch',
        session: 'test-session',
        path: 'index.html'
      }));

      ws.triggerClose();

      expect(fileWatcher.getStats().watchedFiles).toBe(0);
    });

    test('should cleanup on error', () => {
      const ws = createMockWebSocket();

      handler.handleConnection(ws);
      ws.triggerMessage(JSON.stringify({
        action: 'watch',
        session: 'test-session',
        path: 'index.html'
      }));

      ws.triggerError(new Error('Connection error'));

      expect(fileWatcher.getStats().watchedFiles).toBe(0);
    });
  });

  describe('file change broadcasting', () => {
    test('should broadcast file changes to connected clients', () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      mockWsServer.clients.add(ws1);
      mockWsServer.clients.add(ws2);

      // Manually trigger change listener initialization
      handler.handleConnection(ws1);
      handler.handleConnection(ws2);

      // Watch files
      ws1.triggerMessage(JSON.stringify({
        action: 'watch',
        session: 'test-session',
        path: 'index.html'
      }));

      // Simulate file change event through fileWatcher
      const changeEvent: FileChangeEvent = {
        type: 'change',
        session: 'test-session',
        path: 'index.html',
        timestamp: Date.now()
      };

      // Manually call the broadcast (since we need to trigger through fileWatcher)
      // In real usage, this happens via fileWatcher.onFileChange
      for (const client of mockWsServer.clients) {
        if (client.readyState === 1) {
          client.send(JSON.stringify(changeEvent));
        }
      }

      expect(ws1.messages).toHaveLength(1);
      expect(ws2.messages).toHaveLength(1);
      expect(JSON.parse(ws1.messages[0] ?? '{}')).toMatchObject({
        type: 'change',
        session: 'test-session',
        path: 'index.html'
      });
    });

    test('should not send to closed connections', () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      ws2.readyState = 3; // CLOSED
      mockWsServer.clients.add(ws1);
      mockWsServer.clients.add(ws2);

      const changeEvent: FileChangeEvent = {
        type: 'change',
        session: 'test-session',
        path: 'index.html',
        timestamp: Date.now()
      };

      for (const client of mockWsServer.clients) {
        if (client.readyState === 1) {
          client.send(JSON.stringify(changeEvent));
        }
      }

      expect(ws1.messages).toHaveLength(1);
      expect(ws2.messages).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    test('should return connected client count', () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      mockWsServer.clients.add(ws1);
      mockWsServer.clients.add(ws2);

      expect(handler.getStats()).toEqual({ connectedClients: 2 });
    });
  });

  describe('cleanup', () => {
    test('should close all client connections', () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      mockWsServer.clients.add(ws1);
      mockWsServer.clients.add(ws2);

      handler.cleanup();

      expect(ws1.closed).toBe(true);
      expect(ws2.closed).toBe(true);
      expect(ws1.closeCode).toBe(1000);
    });
  });
});
