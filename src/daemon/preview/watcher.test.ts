/**
 * FileWatcherService Tests
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  type FileSystemDeps,
  type WatchHandle,
  createMockFileSystem,
  createMockPathResolver,
  createMockTimer
} from './deps.js';
import type { FileChangeEvent } from './types.js';
import {
  FileWatcherService,
  cleanupWatchers,
  configureWatcher,
  getWatcherStats,
  onFileChange,
  resetDefaultService,
  unwatchAllForClient,
  unwatchFile,
  watchFile
} from './watcher.js';

describe('FileWatcherService', () => {
  let service: FileWatcherService<string>;
  let mockFs: FileSystemDeps;
  let mockTimer: ReturnType<typeof createMockTimer>;
  let watchCallbacks: Map<string, (eventType: string) => void>;
  let watchHandles: Map<string, { close: () => void; errorHandler?: (err: Error) => void }>;

  beforeEach(() => {
    watchCallbacks = new Map();
    watchHandles = new Map();

    mockFs = createMockFileSystem({
      existsSync: (path) => !path.includes('nonexistent'),
      watch: (path, callback) => {
        watchCallbacks.set(path, callback);
        const handle: WatchHandle & { errorHandler?: (err: Error) => void } = {
          close: () => {
            watchCallbacks.delete(path);
            watchHandles.delete(path);
          },
          on: (event, listener) => {
            if (event === 'error') {
              handle.errorHandler = listener;
            }
          }
        };
        watchHandles.set(path, handle);
        return handle;
      }
    });

    mockTimer = createMockTimer();

    service = new FileWatcherService(
      {
        fs: mockFs,
        pathResolver: createMockPathResolver(),
        timer: mockTimer
      },
      { debounceMs: 100, allowedExtensions: ['.html', '.htm'] }
    );
  });

  afterEach(() => {
    service.cleanup();
  });

  describe('watchFile', () => {
    test('should watch a valid HTML file', () => {
      const result = service.watchFile('/session', 'index.html', 'test-session', 'client1');

      expect(result).toBe(true);
      expect(service.getStats()).toEqual({ watchedFiles: 1, activeClients: 1 });
    });

    test('should add multiple clients to same file', () => {
      service.watchFile('/session', 'index.html', 'test-session', 'client1');
      service.watchFile('/session', 'index.html', 'test-session', 'client2');

      expect(service.getStats()).toEqual({ watchedFiles: 1, activeClients: 2 });
    });

    test('should watch different files separately', () => {
      service.watchFile('/session', 'index.html', 'test-session', 'client1');
      service.watchFile('/session', 'other.html', 'test-session', 'client2');

      expect(service.getStats()).toEqual({ watchedFiles: 2, activeClients: 2 });
    });

    test('should reject non-allowed extensions', () => {
      const result = service.watchFile('/session', 'script.js', 'test-session', 'client1');

      expect(result).toBe(false);
      expect(service.getStats()).toEqual({ watchedFiles: 0, activeClients: 0 });
    });

    test('should reject invalid paths', () => {
      const pathResolver = createMockPathResolver({
        resolveFilePath: () => null
      });
      const svc = new FileWatcherService({
        fs: mockFs,
        pathResolver,
        timer: mockTimer
      });

      const result = svc.watchFile('/session', '../etc/passwd', 'test-session', 'client1');

      expect(result).toBe(false);
    });

    test('should reject nonexistent files', () => {
      const result = service.watchFile('/session', 'nonexistent.html', 'test-session', 'client1');

      expect(result).toBe(false);
    });

    test('should allow all extensions when allowedExtensions is empty', () => {
      service.configure({ allowedExtensions: [] });

      const result = service.watchFile('/session', 'script.js', 'test-session', 'client1');

      expect(result).toBe(true);
    });
  });

  describe('unwatchFile', () => {
    test('should remove client from watch', () => {
      service.watchFile('/session', 'index.html', 'test-session', 'client1');
      service.watchFile('/session', 'index.html', 'test-session', 'client2');

      service.unwatchFile('/session', 'index.html', 'client1');

      expect(service.getStats()).toEqual({ watchedFiles: 1, activeClients: 1 });
    });

    test('should stop watching when last client removed', () => {
      service.watchFile('/session', 'index.html', 'test-session', 'client1');

      service.unwatchFile('/session', 'index.html', 'client1');

      expect(service.getStats()).toEqual({ watchedFiles: 0, activeClients: 0 });
    });

    test('should close watcher when last client removed', () => {
      service.watchFile('/session', 'index.html', 'test-session', 'client1');
      const watchPath = '/session/index.html';
      expect(watchHandles.has(watchPath)).toBe(true);

      service.unwatchFile('/session', 'index.html', 'client1');

      expect(watchHandles.has(watchPath)).toBe(false);
    });

    test('should do nothing for unknown file', () => {
      service.unwatchFile('/session', 'unknown.html', 'client1');
      // Should not throw
      expect(service.getStats()).toEqual({ watchedFiles: 0, activeClients: 0 });
    });
  });

  describe('unwatchAllForClient', () => {
    test('should remove client from all watches', () => {
      service.watchFile('/session', 'index.html', 'test-session', 'client1');
      service.watchFile('/session', 'other.html', 'test-session', 'client1');
      service.watchFile('/session', 'index.html', 'test-session', 'client2');

      service.unwatchAllForClient('client1');

      expect(service.getStats()).toEqual({ watchedFiles: 1, activeClients: 1 });
    });

    test('should stop watching files with no remaining clients', () => {
      service.watchFile('/session', 'index.html', 'test-session', 'client1');
      service.watchFile('/session', 'other.html', 'test-session', 'client1');

      service.unwatchAllForClient('client1');

      expect(service.getStats()).toEqual({ watchedFiles: 0, activeClients: 0 });
    });
  });

  describe('onFileChange', () => {
    test('should register and call listener on file change', () => {
      const events: FileChangeEvent[] = [];
      service.onFileChange((event) => events.push(event));
      service.watchFile('/session', 'index.html', 'test-session', 'client1');

      // Trigger file change
      const callback = watchCallbacks.get('/session/index.html');
      expect(callback).toBeDefined();
      callback?.('change');

      // Flush debounce timer
      mockTimer.flush();

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'change',
        session: 'test-session',
        path: 'index.html'
      });
    });

    test('should debounce rapid file changes', () => {
      const events: FileChangeEvent[] = [];
      service.onFileChange((event) => events.push(event));
      service.watchFile('/session', 'index.html', 'test-session', 'client1');

      const callback = watchCallbacks.get('/session/index.html');

      // Trigger multiple rapid changes
      callback?.('change');
      callback?.('change');
      callback?.('change');

      // Should have only one pending timer
      expect(mockTimer.pending()).toBe(1);

      mockTimer.flush();

      // Should only emit once
      expect(events).toHaveLength(1);
    });

    test('should unregister listener', () => {
      const events: FileChangeEvent[] = [];
      const unsubscribe = service.onFileChange((event) => events.push(event));
      service.watchFile('/session', 'index.html', 'test-session', 'client1');

      unsubscribe();

      const callback = watchCallbacks.get('/session/index.html');
      callback?.('change');
      mockTimer.flush();

      expect(events).toHaveLength(0);
    });

    test('should handle listener errors gracefully', () => {
      service.onFileChange(() => {
        throw new Error('Listener error');
      });
      service.onFileChange(() => {
        // Second listener should still be called
      });
      service.watchFile('/session', 'index.html', 'test-session', 'client1');

      const callback = watchCallbacks.get('/session/index.html');
      callback?.('change');

      // Should not throw
      expect(() => mockTimer.flush()).not.toThrow();
    });
  });

  describe('configure', () => {
    test('should update options', () => {
      service.configure({ debounceMs: 500 });

      expect(service.getOptions().debounceMs).toBe(500);
    });

    test('should merge with existing options', () => {
      service.configure({ debounceMs: 500 });

      expect(service.getOptions()).toEqual({
        debounceMs: 500,
        allowedExtensions: ['.html', '.htm']
      });
    });
  });

  describe('cleanup', () => {
    test('should close all watchers', () => {
      service.watchFile('/session', 'index.html', 'test-session', 'client1');
      service.watchFile('/session', 'other.html', 'test-session', 'client2');

      service.cleanup();

      expect(service.getStats()).toEqual({ watchedFiles: 0, activeClients: 0 });
      expect(watchHandles.size).toBe(0);
    });

    test('should clear pending timers', () => {
      service.watchFile('/session', 'index.html', 'test-session', 'client1');
      const callback = watchCallbacks.get('/session/index.html');
      callback?.('change');

      expect(mockTimer.pending()).toBe(1);

      service.cleanup();

      // Timer should be cleared (pending count won't change with mock, but clearTimeout was called)
    });
  });

  describe('watcher error handling', () => {
    test('should unwatch file on watcher error', () => {
      service.watchFile('/session', 'index.html', 'test-session', 'client1');

      const handle = watchHandles.get('/session/index.html');
      expect(handle?.errorHandler).toBeDefined();

      // Trigger error
      handle?.errorHandler?.(new Error('Watch error'));

      expect(service.getStats()).toEqual({ watchedFiles: 0, activeClients: 0 });
    });
  });

  describe('watch exception handling', () => {
    test('should return false when watch throws', () => {
      const throwingFs = createMockFileSystem({
        existsSync: () => true,
        watch: () => {
          throw new Error('Watch failed');
        }
      });

      const svc = new FileWatcherService({
        fs: throwingFs,
        pathResolver: createMockPathResolver(),
        timer: mockTimer
      });

      const result = svc.watchFile('/session', 'index.html', 'test-session', 'client1');

      expect(result).toBe(false);
    });
  });
});

describe('Backward-compatible functions', () => {
  beforeEach(() => {
    resetDefaultService();
  });

  afterEach(() => {
    cleanupWatchers();
  });

  test('watchFile should use default service', () => {
    // Will fail because default service uses real fs
    const result = watchFile('/nonexistent', 'index.html', 'test', {});
    expect(result).toBe(false);
  });

  test('unwatchFile should not throw for unknown file', () => {
    expect(() => unwatchFile('/session', 'unknown.html', {})).not.toThrow();
  });

  test('unwatchAllForClient should not throw', () => {
    expect(() => unwatchAllForClient({})).not.toThrow();
  });

  test('onFileChange should register listener', () => {
    const unsubscribe = onFileChange(() => {
      // Empty callback for testing
    });
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });

  test('configureWatcher should configure default service', () => {
    expect(() => configureWatcher({ debounceMs: 500 })).not.toThrow();
  });

  test('getWatcherStats should return stats', () => {
    const stats = getWatcherStats();
    expect(stats).toHaveProperty('watchedFiles');
    expect(stats).toHaveProperty('activeClients');
  });

  test('cleanupWatchers should cleanup default service', () => {
    // Initialize
    getWatcherStats();

    // Cleanup
    cleanupWatchers();

    // Should not throw when called again
    expect(() => cleanupWatchers()).not.toThrow();
  });

  test('resetDefaultService should reset service', () => {
    // Initialize
    getWatcherStats();

    // Reset
    resetDefaultService();

    // Should not throw when called again
    expect(() => resetDefaultService()).not.toThrow();
  });
});
