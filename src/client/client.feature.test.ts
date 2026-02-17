// Import test setup FIRST to set environment variables before any other imports
import { cleanupTestState, resetTestState } from '../test-setup.js';

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'bun';
import { setDaemonState } from '../config/state.js';
import type { Config } from '../config/types.js';
import { apiRequest, getSessions, getStatus, requestShutdown, startSession, stopSession } from './index.js';

describe('client HTTP API feature tests', () => {
  let mockServer: Server;
  let mockPort: number;

  // Mock responses
  const mockStatus = {
    daemon: { pid: 1234, port: 7680, started_at: '2024-01-01T00:00:00Z' },
    sessions: [
      {
        name: 'test-session',
        pid: 5678,
        port: 7601,
        path: '/test',
        dir: '/home/user/test',
        started_at: '2024-01-01T00:00:00Z',
        fullPath: '/ttyd-mux/test'
      }
    ]
  };

  const mockSessions = mockStatus.sessions;

  const mockNewSession = {
    name: 'new-session',
    pid: 9999,
    port: 7602,
    path: '/new',
    dir: '/home/user/new',
    started_at: '2024-01-01T00:00:00Z',
    fullPath: '/ttyd-mux/new'
  };

  beforeAll(() => {
    resetTestState();

    // Create mock HTTP server
    mockServer = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url);
        const path = url.pathname;
        const method = req.method;

        // GET /ttyd-mux/api/status
        if (path === '/ttyd-mux/api/status' && method === 'GET') {
          return Response.json(mockStatus);
        }

        // GET /ttyd-mux/api/sessions
        if (path === '/ttyd-mux/api/sessions' && method === 'GET') {
          return Response.json(mockSessions);
        }

        // POST /ttyd-mux/api/sessions
        if (path === '/ttyd-mux/api/sessions' && method === 'POST') {
          return Response.json(mockNewSession, { status: 201 });
        }

        // DELETE /ttyd-mux/api/sessions/:name
        if (path.startsWith('/ttyd-mux/api/sessions/') && method === 'DELETE') {
          const name = decodeURIComponent(path.split('/').pop() ?? '');
          if (name === 'nonexistent') {
            return Response.json({ error: 'Session not found' }, { status: 400 });
          }
          return Response.json({ success: true });
        }

        // POST /ttyd-mux/api/shutdown
        if (path === '/ttyd-mux/api/shutdown' && method === 'POST') {
          return Response.json({ success: true });
        }

        // 404 for unknown endpoints
        return Response.json({ error: 'Not found' }, { status: 404 });
      }
    });

    mockPort = mockServer.port;

    // Set daemon state to point to our mock server
    setDaemonState({ pid: 1234, port: mockPort, started_at: new Date().toISOString() });
  });

  afterAll(() => {
    mockServer.stop();
    cleanupTestState();
  });

  const testConfig: Config = {
    base_path: '/ttyd-mux',
    base_port: 7600,
    daemon_port: 7680, // Will be overridden by getDaemonState
    listen_addresses: ['127.0.0.1'],
    auto_attach: true,
    sessions: [],
    proxy_mode: 'proxy',
    caddy_admin_api: 'http://localhost:2019',
    tmux_mode: 'auto'
  };

  describe('getStatus', () => {
    test('returns status response', async () => {
      const status = await getStatus(testConfig);

      expect(status).toHaveProperty('daemon');
      expect(status).toHaveProperty('sessions');
      expect(status.daemon?.pid).toBe(1234);
      expect(status.sessions).toHaveLength(1);
      expect(status.sessions[0].name).toBe('test-session');
    });
  });

  describe('getSessions', () => {
    test('returns sessions array', async () => {
      const sessions = await getSessions(testConfig);

      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].name).toBe('test-session');
      expect(sessions[0].port).toBe(7601);
    });
  });

  describe('startSession', () => {
    test('creates new session', async () => {
      const request = { name: 'new-session', dir: '/home/user/new' };
      const session = await startSession(testConfig, request);

      expect(session.name).toBe('new-session');
      expect(session.port).toBe(7602);
      expect(session.fullPath).toBe('/ttyd-mux/new');
    });
  });

  describe('stopSession', () => {
    test('stops existing session', async () => {
      // Should not throw
      await stopSession(testConfig, 'test-session');
    });

    test('throws error for nonexistent session', async () => {
      await expect(stopSession(testConfig, 'nonexistent')).rejects.toThrow('Session not found');
    });
  });

  describe('requestShutdown', () => {
    test('sends shutdown request', async () => {
      // Should not throw
      await requestShutdown(testConfig);
    });
  });

  describe('apiRequest', () => {
    test('handles GET request', async () => {
      const data = await apiRequest(testConfig, 'GET', '/api/status');
      expect(data).toHaveProperty('daemon');
    });

    test('handles POST request with body', async () => {
      const data = await apiRequest(testConfig, 'POST', '/api/sessions', {
        name: 'test',
        dir: '/test'
      });
      expect(data).toHaveProperty('name');
    });

    test('throws error for 404 response', async () => {
      await expect(apiRequest(testConfig, 'GET', '/api/unknown')).rejects.toThrow('Not found');
    });
  });
});
