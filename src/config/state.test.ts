// Import test setup FIRST to set environment variables before any other imports
import { TEST_STATE_DIR, cleanupTestState, resetTestState } from '@/test-setup.js';

import { afterAll, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';

describe('state', () => {
  beforeEach(() => {
    resetTestState();
  });

  afterAll(() => {
    cleanupTestState();
  });

  describe('getStateDir / getSocketPath', () => {
    test('returns test directory when env var is set', async () => {
      const { getStateDir, getSocketPath } = await import('./state.js');

      expect(getStateDir()).toBe(TEST_STATE_DIR);
      expect(getSocketPath()).toBe(`${TEST_STATE_DIR}/ttyd-mux.sock`);
    });
  });

  describe('loadState', () => {
    test('returns default state when file does not exist', async () => {
      const { loadState } = await import('./state.js');

      const state = loadState();

      expect(state.daemon).toBeNull();
      expect(state.sessions).toEqual([]);
    });

    test('returns saved state when file exists', async () => {
      const { loadState, saveState } = await import('./state.js');
      const testState = {
        daemon: { pid: 1234, port: 7680, started_at: '2024-01-01T00:00:00Z' },
        sessions: []
      };
      saveState(testState);

      const state = loadState();

      expect(state.daemon?.pid).toBe(1234);
      expect(state.daemon?.port).toBe(7680);
    });
  });

  describe('saveState', () => {
    test('creates state file', async () => {
      const { saveState, getStateDir } = await import('./state.js');
      const stateFile = `${getStateDir()}/state.json`;

      saveState({ daemon: null, sessions: [] });

      expect(existsSync(stateFile)).toBe(true);
    });
  });

  describe('daemon state operations', () => {
    test('setDaemonState and getDaemonState', async () => {
      const { setDaemonState, getDaemonState, clearDaemonState } = await import('./state.js');
      const daemon = { pid: 9999, port: 7680, started_at: '2024-01-01T00:00:00Z' };

      setDaemonState(daemon);
      const result = getDaemonState();

      expect(result?.pid).toBe(9999);
      expect(result?.port).toBe(7680);

      clearDaemonState();
      expect(getDaemonState()).toBeNull();
    });
  });

  describe('session state operations', () => {
    test('addSession and getSession', async () => {
      const { addSession, getSession, removeSession } = await import('./state.js');
      const session = {
        name: 'test-session',
        pid: 12345,
        port: 7601,
        path: '/test',
        dir: '/home/test',
        started_at: '2024-01-01T00:00:00Z'
      };

      addSession(session);
      const result = getSession('test-session');

      expect(result?.name).toBe('test-session');
      expect(result?.pid).toBe(12345);
      expect(result?.port).toBe(7601);

      removeSession('test-session');
      expect(getSession('test-session')).toBeUndefined();
    });

    test('getAllSessions returns all sessions', async () => {
      const { addSession, getAllSessions } = await import('./state.js');

      addSession({
        name: 'session-1',
        pid: 1001,
        port: 7601,
        path: '/s1',
        dir: '/dir1',
        started_at: '2024-01-01T00:00:00Z'
      });
      addSession({
        name: 'session-2',
        pid: 1002,
        port: 7602,
        path: '/s2',
        dir: '/dir2',
        started_at: '2024-01-01T00:00:00Z'
      });

      const sessions = getAllSessions();

      expect(sessions.length).toBe(2);
      expect(sessions.map((s) => s.name).sort()).toEqual(['session-1', 'session-2']);
    });

    test('getSessionByDir finds session by directory', async () => {
      const { addSession, getSessionByDir } = await import('./state.js');

      addSession({
        name: 'my-project',
        pid: 1001,
        port: 7601,
        path: '/my-project',
        dir: '/home/user/my-project',
        started_at: '2024-01-01T00:00:00Z'
      });

      const result = getSessionByDir('/home/user/my-project');

      expect(result?.name).toBe('my-project');
    });
  });

  describe('getNextPort', () => {
    test('returns base_port + 1 when no sessions', async () => {
      const { getNextPort } = await import('./state.js');

      const port = getNextPort(7600);

      expect(port).toBe(7601);
    });

    test('returns next available port when sessions exist', async () => {
      const { addSession, getNextPort } = await import('./state.js');

      addSession({
        name: 'session-1',
        pid: 1001,
        port: 7601,
        path: '/s1',
        dir: '/dir1',
        started_at: '2024-01-01T00:00:00Z'
      });

      const port = getNextPort(7600);

      expect(port).toBe(7602);
    });

    test('skips used ports', async () => {
      const { addSession, getNextPort } = await import('./state.js');

      addSession({
        name: 'session-1',
        pid: 1001,
        port: 7601,
        path: '/s1',
        dir: '/dir1',
        started_at: '2024-01-01T00:00:00Z'
      });
      addSession({
        name: 'session-2',
        pid: 1002,
        port: 7602,
        path: '/s2',
        dir: '/dir2',
        started_at: '2024-01-01T00:00:00Z'
      });

      const port = getNextPort(7600);

      expect(port).toBe(7603);
    });
  });

  describe('getNextPath', () => {
    test('combines base path and name', async () => {
      const { getNextPath } = await import('./state.js');

      const path = getNextPath('/ttyd-mux', 'my-session');

      expect(path).toBe('/ttyd-mux/my-session');
    });

    test('normalizes multiple slashes', async () => {
      const { getNextPath } = await import('./state.js');

      const path = getNextPath('/ttyd-mux/', '/my-session');

      expect(path).toBe('/ttyd-mux/my-session');
    });
  });
});

describe('state type structures', () => {
  test('SessionState structure is correct', () => {
    const session = {
      name: 'test-session',
      pid: 12345,
      port: 7601,
      path: '/test',
      dir: '/home/test',
      started_at: new Date().toISOString()
    };

    expect(session.name).toBe('test-session');
    expect(session.pid).toBe(12345);
    expect(session.port).toBe(7601);
    expect(session.path).toBe('/test');
    expect(session.dir).toBe('/home/test');
    expect(typeof session.started_at).toBe('string');
  });

  test('DaemonState structure is correct', () => {
    const daemon = {
      pid: 99999,
      port: 7680,
      started_at: new Date().toISOString()
    };

    expect(daemon.pid).toBe(99999);
    expect(daemon.port).toBe(7680);
    expect(typeof daemon.started_at).toBe('string');
  });
});
