import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { Config, SessionState } from '../config/types.js';
import { createSessionResolver } from './session-resolver.js';

// Mock state functions
const mockSessions: SessionState[] = [];

mock.module('../config/state.js', () => ({
  getAllSessions: () => mockSessions,
  getSession: (name: string) => mockSessions.find((s) => s.name === name),
  getSessionByDir: (dir: string) => mockSessions.find((s) => s.dir === dir)
}));

describe('SessionResolver', () => {
  const baseConfig: Config = {
    base_path: '/ttyd-mux',
    base_port: 7600,
    daemon_port: 7680,
    listen_addresses: ['127.0.0.1'],
    auto_attach: true,
    sessions: [
      { name: 'config-session', dir: '/home/user/config', path: '/config', port_offset: 1 },
      { name: 'another-session', dir: '/home/user/another', path: '/another', port_offset: 2 }
    ]
  };

  beforeEach(() => {
    mockSessions.length = 0;
  });

  afterEach(() => {
    mockSessions.length = 0;
  });

  describe('byName', () => {
    test('finds session by name', () => {
      const session: SessionState = {
        name: 'test-session',
        pid: 1234,
        port: 7601,
        path: '/test',
        dir: '/home/user/test',
        started_at: '2024-01-01T00:00:00Z'
      };
      mockSessions.push(session);

      const resolver = createSessionResolver(baseConfig);
      expect(resolver.byName('test-session')).toEqual(session);
    });

    test('returns undefined for non-existent session', () => {
      const resolver = createSessionResolver(baseConfig);
      expect(resolver.byName('non-existent')).toBeUndefined();
    });
  });

  describe('byDir', () => {
    test('finds session by directory', () => {
      const session: SessionState = {
        name: 'test-session',
        pid: 1234,
        port: 7601,
        path: '/test',
        dir: '/home/user/test',
        started_at: '2024-01-01T00:00:00Z'
      };
      mockSessions.push(session);

      const resolver = createSessionResolver(baseConfig);
      expect(resolver.byDir('/home/user/test')).toEqual(session);
    });

    test('returns undefined for non-existent directory', () => {
      const resolver = createSessionResolver(baseConfig);
      expect(resolver.byDir('/non/existent')).toBeUndefined();
    });
  });

  describe('byPath', () => {
    test('finds session by URL path', () => {
      const session: SessionState = {
        name: 'test-session',
        pid: 1234,
        port: 7601,
        path: '/test',
        dir: '/home/user/test',
        started_at: '2024-01-01T00:00:00Z'
      };
      mockSessions.push(session);

      const resolver = createSessionResolver(baseConfig);
      expect(resolver.byPath('/ttyd-mux/test/ws')).toEqual(session);
    });

    test('finds session for exact path match', () => {
      const session: SessionState = {
        name: 'test-session',
        pid: 1234,
        port: 7601,
        path: '/test',
        dir: '/home/user/test',
        started_at: '2024-01-01T00:00:00Z'
      };
      mockSessions.push(session);

      const resolver = createSessionResolver(baseConfig);
      expect(resolver.byPath('/ttyd-mux/test')).toEqual(session);
    });

    test('returns null for non-matching path', () => {
      const resolver = createSessionResolver(baseConfig);
      expect(resolver.byPath('/ttyd-mux/non-existent')).toBeNull();
    });
  });

  describe('definitionByName', () => {
    test('finds session definition from config', () => {
      const resolver = createSessionResolver(baseConfig);
      const definition = resolver.definitionByName('config-session');
      expect(definition).toBeDefined();
      expect(definition?.dir).toBe('/home/user/config');
    });

    test('returns undefined for non-existent definition', () => {
      const resolver = createSessionResolver(baseConfig);
      expect(resolver.definitionByName('non-existent')).toBeUndefined();
    });
  });

  describe('exists', () => {
    test('returns true for existing session', () => {
      mockSessions.push({
        name: 'test',
        pid: 1234,
        port: 7601,
        path: '/test',
        dir: '/test',
        started_at: '2024-01-01T00:00:00Z'
      });

      const resolver = createSessionResolver(baseConfig);
      expect(resolver.exists('test')).toBe(true);
    });

    test('returns false for non-existent session', () => {
      const resolver = createSessionResolver(baseConfig);
      expect(resolver.exists('non-existent')).toBe(false);
    });
  });

  describe('all', () => {
    test('returns all sessions', () => {
      mockSessions.push(
        {
          name: 'session1',
          pid: 1234,
          port: 7601,
          path: '/s1',
          dir: '/s1',
          started_at: '2024-01-01T00:00:00Z'
        },
        {
          name: 'session2',
          pid: 5678,
          port: 7602,
          path: '/s2',
          dir: '/s2',
          started_at: '2024-01-01T00:00:00Z'
        }
      );

      const resolver = createSessionResolver(baseConfig);
      expect(resolver.all()).toHaveLength(2);
    });
  });
});
