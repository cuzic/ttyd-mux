import { describe, expect, test } from 'bun:test';
import type {
  Config,
  DaemonState,
  ResolvedSession,
  SessionDefinition,
  SessionResponse,
  SessionState,
  StartSessionRequest,
  State,
  StatusResponse
} from './types.js';

describe('types', () => {
  describe('Config', () => {
    test('can create valid Config object', () => {
      const config: Config = {
        base_path: '/ttyd-mux',
        base_port: 7600,
        daemon_port: 7680,
        sessions: []
      };

      expect(config.base_path).toBe('/ttyd-mux');
      expect(config.base_port).toBe(7600);
      expect(config.daemon_port).toBe(7680);
      expect(config.sessions).toEqual([]);
    });

    test('sessions is optional', () => {
      const config: Config = {
        base_path: '/ttyd-mux',
        base_port: 7600,
        daemon_port: 7680
      };

      expect(config.sessions).toBeUndefined();
    });
  });

  describe('SessionDefinition', () => {
    test('can create valid SessionDefinition', () => {
      const session: SessionDefinition = {
        name: 'test-session',
        dir: '/home/user/test',
        path: '/test',
        port_offset: 1
      };

      expect(session.name).toBe('test-session');
      expect(session.dir).toBe('/home/user/test');
      expect(session.path).toBe('/test');
      expect(session.port_offset).toBe(1);
    });
  });

  describe('SessionState', () => {
    test('can create valid SessionState', () => {
      const state: SessionState = {
        name: 'test-session',
        pid: 12345,
        port: 7601,
        path: '/test',
        dir: '/home/user/test',
        started_at: '2024-01-01T00:00:00Z'
      };

      expect(state.name).toBe('test-session');
      expect(state.pid).toBe(12345);
      expect(state.port).toBe(7601);
      expect(state.path).toBe('/test');
      expect(state.dir).toBe('/home/user/test');
      expect(state.started_at).toBe('2024-01-01T00:00:00Z');
    });
  });

  describe('DaemonState', () => {
    test('can create valid DaemonState', () => {
      const state: DaemonState = {
        pid: 99999,
        port: 7680,
        started_at: '2024-01-01T00:00:00Z'
      };

      expect(state.pid).toBe(99999);
      expect(state.port).toBe(7680);
      expect(state.started_at).toBe('2024-01-01T00:00:00Z');
    });
  });

  describe('State', () => {
    test('can create State with no daemon', () => {
      const state: State = {
        daemon: null,
        sessions: []
      };

      expect(state.daemon).toBeNull();
      expect(state.sessions).toEqual([]);
    });

    test('can create State with daemon and sessions', () => {
      const state: State = {
        daemon: {
          pid: 99999,
          port: 7680,
          started_at: '2024-01-01T00:00:00Z'
        },
        sessions: [
          {
            name: 'test',
            pid: 12345,
            port: 7601,
            path: '/test',
            dir: '/home/user/test',
            started_at: '2024-01-01T00:00:00Z'
          }
        ]
      };

      expect(state.daemon).not.toBeNull();
      expect(state.sessions).toHaveLength(1);
    });
  });

  describe('ResolvedSession', () => {
    test('can create valid ResolvedSession', () => {
      const session: ResolvedSession = {
        name: 'test-session',
        dir: '/home/user/test',
        path: '/test',
        fullPath: '/ttyd-mux/test',
        port: 7601,
        running: true,
        pid: 12345
      };

      expect(session.fullPath).toBe('/ttyd-mux/test');
      expect(session.running).toBe(true);
      expect(session.pid).toBe(12345);
    });

    test('pid is optional', () => {
      const session: ResolvedSession = {
        name: 'test-session',
        dir: '/home/user/test',
        path: '/test',
        fullPath: '/ttyd-mux/test',
        port: 7601,
        running: false
      };

      expect(session.pid).toBeUndefined();
      expect(session.running).toBe(false);
    });
  });

  describe('StartSessionRequest', () => {
    test('can create minimal request', () => {
      const request: StartSessionRequest = {
        name: 'my-session',
        dir: '/home/user/project'
      };

      expect(request.name).toBe('my-session');
      expect(request.dir).toBe('/home/user/project');
      expect(request.path).toBeUndefined();
    });

    test('can create request with path', () => {
      const request: StartSessionRequest = {
        name: 'my-session',
        dir: '/home/user/project',
        path: '/custom'
      };

      expect(request.path).toBe('/custom');
    });
  });

  describe('SessionResponse', () => {
    test('can create valid response', () => {
      const response: SessionResponse = {
        name: 'test',
        port: 7601,
        path: '/test',
        fullPath: '/ttyd-mux/test',
        dir: '/home/user/test',
        pid: 12345,
        started_at: '2024-01-01T00:00:00Z'
      };

      expect(response.name).toBe('test');
      expect(response.fullPath).toBe('/ttyd-mux/test');
    });
  });

  describe('StatusResponse', () => {
    test('can create valid status response', () => {
      const response: StatusResponse = {
        daemon: {
          pid: 99999,
          port: 7680,
          started_at: '2024-01-01T00:00:00Z'
        },
        sessions: []
      };

      expect(response.daemon.pid).toBe(99999);
      expect(response.sessions).toEqual([]);
    });
  });
});
