import { describe, expect, test } from 'bun:test';
import { createInMemoryStateStore } from './state-store.js';

describe('createInMemoryStateStore', () => {
  describe('path accessors', () => {
    test('getStateDir returns test path', () => {
      const store = createInMemoryStateStore();
      expect(store.getStateDir()).toBe('/tmp/test-state');
    });

    test('getSocketPath returns test socket path', () => {
      const store = createInMemoryStateStore();
      expect(store.getSocketPath()).toBe('/tmp/test-state/ttyd-mux.sock');
    });
  });

  describe('state management', () => {
    test('loadState returns default state when empty', () => {
      const store = createInMemoryStateStore();
      const state = store.loadState();
      expect(state.daemon).toBeNull();
      expect(state.sessions).toEqual([]);
    });

    test('loadState returns initial state', () => {
      const store = createInMemoryStateStore({
        daemon: { pid: 123, port: 7680, started_at: '2024-01-01' },
        sessions: [
          {
            name: 'test',
            pid: 456,
            port: 7601,
            path: '/test',
            dir: '/home',
            started_at: '2024-01-01'
          }
        ]
      });
      const state = store.loadState();
      expect(state.daemon?.pid).toBe(123);
      expect(state.sessions.length).toBe(1);
    });

    test('saveState updates state', () => {
      const store = createInMemoryStateStore();
      store.saveState({
        daemon: { pid: 999, port: 7680, started_at: '2024-01-01' },
        sessions: []
      });
      const state = store.loadState();
      expect(state.daemon?.pid).toBe(999);
    });

    test('loadState returns a copy (immutable)', () => {
      const store = createInMemoryStateStore();
      const state1 = store.loadState();
      state1.sessions.push({
        name: 'modified',
        pid: 1,
        port: 1,
        path: '/',
        dir: '/',
        started_at: ''
      });
      const state2 = store.loadState();
      expect(state2.sessions.length).toBe(0);
    });
  });

  describe('daemon state', () => {
    test('getDaemonState returns null when not set', () => {
      const store = createInMemoryStateStore();
      expect(store.getDaemonState()).toBeNull();
    });

    test('setDaemonState updates daemon state', () => {
      const store = createInMemoryStateStore();
      store.setDaemonState({ pid: 123, port: 7680, started_at: '2024-01-01' });
      expect(store.getDaemonState()?.pid).toBe(123);
    });

    test('clearDaemonState removes daemon state', () => {
      const store = createInMemoryStateStore({
        daemon: { pid: 123, port: 7680, started_at: '2024-01-01' }
      });
      store.clearDaemonState();
      expect(store.getDaemonState()).toBeNull();
    });
  });

  describe('session state', () => {
    test('addSession adds new session', () => {
      const store = createInMemoryStateStore();
      store.addSession({
        name: 'test',
        pid: 123,
        port: 7601,
        path: '/test',
        dir: '/home',
        started_at: '2024-01-01'
      });
      expect(store.getAllSessions().length).toBe(1);
      expect(store.getSession('test')?.pid).toBe(123);
    });

    test('addSession replaces session with same name', () => {
      const store = createInMemoryStateStore();
      store.addSession({
        name: 'test',
        pid: 123,
        port: 7601,
        path: '/test',
        dir: '/home',
        started_at: '2024-01-01'
      });
      store.addSession({
        name: 'test',
        pid: 456,
        port: 7602,
        path: '/test2',
        dir: '/home2',
        started_at: '2024-01-02'
      });
      expect(store.getAllSessions().length).toBe(1);
      expect(store.getSession('test')?.pid).toBe(456);
    });

    test('removeSession removes session', () => {
      const store = createInMemoryStateStore();
      store.addSession({
        name: 'test',
        pid: 123,
        port: 7601,
        path: '/test',
        dir: '/home',
        started_at: '2024-01-01'
      });
      store.removeSession('test');
      expect(store.getAllSessions().length).toBe(0);
      expect(store.getSession('test')).toBeUndefined();
    });

    test('getSession returns undefined for non-existent session', () => {
      const store = createInMemoryStateStore();
      expect(store.getSession('nonexistent')).toBeUndefined();
    });

    test('getSessionByDir finds session by directory', () => {
      const store = createInMemoryStateStore();
      store.addSession({
        name: 'test',
        pid: 123,
        port: 7601,
        path: '/test',
        dir: '/home/user/project',
        started_at: '2024-01-01'
      });
      expect(store.getSessionByDir('/home/user/project')?.name).toBe('test');
    });

    test('getSessionByDir returns undefined for unknown directory', () => {
      const store = createInMemoryStateStore();
      expect(store.getSessionByDir('/unknown')).toBeUndefined();
    });

    test('getAllSessions returns copy of sessions array', () => {
      const store = createInMemoryStateStore();
      store.addSession({
        name: 'test',
        pid: 123,
        port: 7601,
        path: '/test',
        dir: '/home',
        started_at: '2024-01-01'
      });
      const sessions = store.getAllSessions();
      sessions.push({ name: 'modified', pid: 1, port: 1, path: '/', dir: '/', started_at: '' });
      expect(store.getAllSessions().length).toBe(1);
    });
  });

  describe('utilities', () => {
    test('getNextPort returns basePort + 1 when no sessions', () => {
      const store = createInMemoryStateStore();
      expect(store.getNextPort(7600)).toBe(7601);
    });

    test('getNextPort returns next available port', () => {
      const store = createInMemoryStateStore();
      store.addSession({
        name: 'test1',
        pid: 1,
        port: 7601,
        path: '/t1',
        dir: '/d1',
        started_at: ''
      });
      store.addSession({
        name: 'test2',
        pid: 2,
        port: 7602,
        path: '/t2',
        dir: '/d2',
        started_at: ''
      });
      expect(store.getNextPort(7600)).toBe(7603);
    });

    test('getNextPort skips used ports', () => {
      const store = createInMemoryStateStore();
      store.addSession({
        name: 'test1',
        pid: 1,
        port: 7601,
        path: '/t1',
        dir: '/d1',
        started_at: ''
      });
      store.addSession({
        name: 'test2',
        pid: 2,
        port: 7603,
        path: '/t2',
        dir: '/d2',
        started_at: ''
      });
      // 7602 is available, so it should return 7602
      expect(store.getNextPort(7600)).toBe(7602);
    });

    test('getNextPath constructs path from basePath and name', () => {
      const store = createInMemoryStateStore();
      expect(store.getNextPath('/ttyd-mux', 'my-project')).toBe('/ttyd-mux/my-project');
    });

    test('getNextPath normalizes double slashes', () => {
      const store = createInMemoryStateStore();
      expect(store.getNextPath('/ttyd-mux/', 'my-project')).toBe('/ttyd-mux/my-project');
    });
  });
});
