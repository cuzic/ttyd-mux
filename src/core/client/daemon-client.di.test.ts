import { afterEach, describe, expect, mock, test } from 'bun:test';
import { createInMemoryStateStore } from '@/core/config/state-store.js';
import { createMockProcessRunner } from '@/utils/process-runner.js';
import { createMockSocketClient } from '@/utils/socket-client.js';
import {
  ensureDaemon,
  isDaemonRunning,
  resetDaemonClientDeps,
  setDaemonClientDeps,
  shutdownDaemon
} from './daemon-client.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  resetDaemonClientDeps();
  globalThis.fetch = originalFetch;
});

describe('DaemonClient with DI', () => {
  describe('isDaemonRunning', () => {
    test('returns false when socket does not exist', async () => {
      const stateStore = createInMemoryStateStore();
      const socketClient = createMockSocketClient({
        exists: async () => false
      });

      setDaemonClientDeps({ stateStore, socketClient });

      const result = await isDaemonRunning();

      expect(result).toBe(false);
    });

    test('returns true when daemon responds with ok', async () => {
      const stateStore = createInMemoryStateStore();
      const socketClient = createMockSocketClient({
        exists: async () => true
      });

      globalThis.fetch = mock(() =>
        Promise.resolve(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }))
      ) as typeof fetch;

      setDaemonClientDeps({ stateStore, socketClient });

      const result = await isDaemonRunning();

      expect(result).toBe(true);
    });

    test('returns false when fetch fails', async () => {
      const stateStore = createInMemoryStateStore();
      const socketClient = createMockSocketClient({
        exists: async () => true
      });

      globalThis.fetch = mock(() =>
        Promise.reject(new Error('Connection refused'))
      ) as typeof fetch;

      setDaemonClientDeps({ stateStore, socketClient });

      const result = await isDaemonRunning();

      expect(result).toBe(false);
    });

    test('returns false when response is not ok', async () => {
      const stateStore = createInMemoryStateStore();
      const socketClient = createMockSocketClient({
        exists: async () => true
      });

      globalThis.fetch = mock(() =>
        Promise.resolve(new Response('Not Found', { status: 404 }))
      ) as typeof fetch;

      setDaemonClientDeps({ stateStore, socketClient });

      const result = await isDaemonRunning();

      expect(result).toBe(false);
    });
  });

  describe('shutdownDaemon', () => {
    test('sends shutdown request when socket exists', async () => {
      const stateStore = createInMemoryStateStore();
      const socketClient = createMockSocketClient({
        exists: async () => true
      });
      const mockFetch = mock(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ status: 'shutting_down', stopSessions: false, killTmux: false }),
            { status: 200 }
          )
        )
      ) as typeof fetch;
      globalThis.fetch = mockFetch;

      setDaemonClientDeps({ stateStore, socketClient });

      await shutdownDaemon();

      expect(mockFetch).toHaveBeenCalled();
      const [url] = (mockFetch as ReturnType<typeof mock>).mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost/api/shutdown');
    });

    test('sends stopSessions option in body', async () => {
      const stateStore = createInMemoryStateStore();
      const socketClient = createMockSocketClient({
        exists: async () => true
      });
      const mockFetch = mock(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ status: 'shutting_down', stopSessions: true, killTmux: false }),
            { status: 200 }
          )
        )
      ) as typeof fetch;
      globalThis.fetch = mockFetch;

      setDaemonClientDeps({ stateStore, socketClient });

      await shutdownDaemon({ stopSessions: true });

      const [, init] = (mockFetch as ReturnType<typeof mock>).mock.calls[0] as [
        string,
        RequestInit & { unix?: string }
      ];
      const body = JSON.parse(init.body as string);
      expect(body.stopSessions).toBe(true);
    });

    test('resolves immediately when socket does not exist', async () => {
      const stateStore = createInMemoryStateStore();
      const socketClient = createMockSocketClient({
        exists: async () => false
      });

      setDaemonClientDeps({ stateStore, socketClient });

      // Should not throw and resolve quickly
      await shutdownDaemon();
    });

    test('resolves even when fetch fails (server shutting down)', async () => {
      const stateStore = createInMemoryStateStore();
      const socketClient = createMockSocketClient({
        exists: async () => true
      });

      globalThis.fetch = mock(() => Promise.reject(new Error('Connection reset'))) as typeof fetch;

      setDaemonClientDeps({ stateStore, socketClient });

      // Should not throw — connection loss is expected during shutdown
      await shutdownDaemon();
    });
  });

  describe('ensureDaemon', () => {
    test('does not spawn if daemon is already running', async () => {
      const stateStore = createInMemoryStateStore();
      const socketClient = createMockSocketClient({
        exists: async () => true
      });
      let spawnCalled = false;

      globalThis.fetch = mock(() =>
        Promise.resolve(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }))
      ) as typeof fetch;

      const processRunner = createMockProcessRunner({
        spawn: () => {
          spawnCalled = true;
          throw new Error('Should not be called');
        }
      });

      setDaemonClientDeps({ stateStore, socketClient, processRunner });

      await ensureDaemon();

      expect(spawnCalled).toBe(false);
    });
  });
});
