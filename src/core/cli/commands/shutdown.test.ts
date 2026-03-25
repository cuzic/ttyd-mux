import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { resetDaemonClientDeps, setDaemonClientDeps } from '@/core/client/daemon-client.js';
import { createInMemoryStateStore } from '@/core/config/state-store.js';
import { createMockSocketClient } from '@/utils/socket-client.js';
import { shutdownCommand } from './shutdown.js';

const originalFetch = globalThis.fetch;

describe('shutdown command', () => {
  let consoleLogSpy: ReturnType<typeof spyOn>;
  let logs: string[];

  beforeEach(() => {
    logs = [];
    consoleLogSpy = spyOn(console, 'log').mockImplementation((msg: string) => {
      logs.push(msg);
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    resetDaemonClientDeps();
    globalThis.fetch = originalFetch;
  });

  test('prints message when daemon is not running', async () => {
    const stateStore = createInMemoryStateStore();
    const socketClient = createMockSocketClient({
      exists: async () => false
    });

    setDaemonClientDeps({ stateStore, socketClient });

    await shutdownCommand({});

    expect(logs).toContain('Daemon is not running.');
  });

  test('shuts down daemon without stopping sessions by default', async () => {
    const stateStore = createInMemoryStateStore();
    const socketClient = createMockSocketClient({
      exists: async () => true
    });

    const fetchUrls: string[] = [];
    globalThis.fetch = mock((url: string | URL | Request) => {
      const urlStr = url.toString();
      fetchUrls.push(urlStr);
      if (urlStr.includes('/api/ping')) {
        return Promise.resolve(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }));
      }
      if (urlStr.includes('/api/shutdown')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ status: 'shutting_down', stopSessions: false, killTmux: false }),
            { status: 200 }
          )
        );
      }
      return Promise.resolve(new Response('Not Found', { status: 404 }));
    }) as typeof fetch;

    setDaemonClientDeps({ stateStore, socketClient });

    await shutdownCommand({});

    expect(fetchUrls.some((u) => u.includes('/api/ping'))).toBe(true);
    expect(fetchUrls.some((u) => u.includes('/api/shutdown'))).toBe(true);
    expect(logs.some((log) => log.includes('sessions will be preserved'))).toBe(true);
  });

  test('stops sessions when --stop-sessions option is provided', async () => {
    const stateStore = createInMemoryStateStore();
    const socketClient = createMockSocketClient({
      exists: async () => true
    });

    const fetchBodies: unknown[] = [];
    globalThis.fetch = mock((url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/ping')) {
        return Promise.resolve(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }));
      }
      if (urlStr.includes('/api/shutdown')) {
        if (init?.body) {
          fetchBodies.push(JSON.parse(init.body as string));
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({ status: 'shutting_down', stopSessions: true, killTmux: false }),
            { status: 200 }
          )
        );
      }
      return Promise.resolve(new Response('Not Found', { status: 404 }));
    }) as typeof fetch;

    setDaemonClientDeps({ stateStore, socketClient });

    await shutdownCommand({ stopSessions: true });

    expect(fetchBodies.length).toBeGreaterThan(0);
    expect((fetchBodies[0] as { stopSessions: boolean }).stopSessions).toBe(true);
    expect(logs.some((log) => log.includes('Stopping all sessions'))).toBe(true);
  });
});
