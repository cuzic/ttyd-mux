// Import test setup FIRST to set environment variables before any other imports
import { cleanupTestState, resetTestState } from '../test-setup.js';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';
import type { Config } from '../config/types.js';
import { createDaemonServer, findSessionForPath } from './server.js';

describe('server feature tests', () => {
  let server: Server;
  let serverPort: number;
  let baseUrl: string;

  const testConfig: Config = {
    base_path: '/ttyd-mux',
    base_port: 7600,
    daemon_port: 0, // Let OS assign port
    listen_addresses: ['127.0.0.1'],
    auto_attach: true,
    sessions: [],
    proxy_mode: 'proxy',
    caddy_admin_api: 'http://localhost:2019',
    tmux_mode: 'auto'
  };

  beforeAll(() => {
    resetTestState();
    server = createDaemonServer(testConfig);

    // Start server on random port
    return new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (address && typeof address === 'object') {
          serverPort = address.port;
          baseUrl = `http://127.0.0.1:${serverPort}`;
        }
        resolve();
      });
    });
  });

  afterAll(() => {
    return new Promise<void>((resolve) => {
      server.close(() => {
        cleanupTestState();
        resolve();
      });
    });
  });

  describe('portal page', () => {
    test('GET /ttyd-mux/ returns HTML portal', async () => {
      const response = await fetch(`${baseUrl}/ttyd-mux/`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');

      const html = await response.text();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('ttyd-mux');
    });

    test('GET /ttyd-mux returns HTML portal (without trailing slash)', async () => {
      const response = await fetch(`${baseUrl}/ttyd-mux`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
    });
  });

  describe('API endpoints', () => {
    test('GET /ttyd-mux/api/status returns daemon status', async () => {
      const response = await fetch(`${baseUrl}/ttyd-mux/api/status`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');

      const data = await response.json();
      expect(data).toHaveProperty('daemon');
      expect(data).toHaveProperty('sessions');
      expect(Array.isArray(data.sessions)).toBe(true);
    });

    test('GET /ttyd-mux/api/sessions returns sessions list', async () => {
      const response = await fetch(`${baseUrl}/ttyd-mux/api/sessions`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    test('GET /ttyd-mux/api/unknown returns 404', async () => {
      const response = await fetch(`${baseUrl}/ttyd-mux/api/unknown`);

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    test('DELETE /ttyd-mux/api/sessions/nonexistent returns 400', async () => {
      const response = await fetch(`${baseUrl}/ttyd-mux/api/sessions/nonexistent-session`, {
        method: 'DELETE'
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    test('POST /ttyd-mux/api/sessions with invalid JSON returns 400', async () => {
      const response = await fetch(`${baseUrl}/ttyd-mux/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error');
    });
  });

  describe('404 handling', () => {
    test('GET /unknown returns 404', async () => {
      const response = await fetch(`${baseUrl}/unknown-path`);

      expect(response.status).toBe(404);
    });

    test('GET /ttyd-mux/nonexistent-session returns 404', async () => {
      const response = await fetch(`${baseUrl}/ttyd-mux/nonexistent-session`);

      expect(response.status).toBe(404);
    });
  });
});

describe('findSessionForPath', () => {
  beforeEach(() => {
    resetTestState();
  });

  afterEach(() => {
    cleanupTestState();
  });

  const testConfig: Config = {
    base_path: '/ttyd-mux',
    base_port: 7600,
    daemon_port: 7680,
    listen_addresses: ['127.0.0.1'],
    auto_attach: true,
    sessions: [],
    proxy_mode: 'proxy',
    caddy_admin_api: 'http://localhost:2019',
    tmux_mode: 'auto'
  };

  test('returns null when no sessions exist', () => {
    const result = findSessionForPath(testConfig, '/ttyd-mux/some-session');
    expect(result).toBeNull();
  });

  test('returns null for base path', () => {
    const result = findSessionForPath(testConfig, '/ttyd-mux');
    expect(result).toBeNull();
  });

  test('returns null for API path', () => {
    const result = findSessionForPath(testConfig, '/ttyd-mux/api/sessions');
    expect(result).toBeNull();
  });
});
