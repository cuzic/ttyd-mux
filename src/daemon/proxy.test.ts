import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { Config, SessionState } from '../config/types.js';

// Mock session-manager to avoid side effects
mock.module('./session-manager.js', () => ({
  listSessions: () => mockSessions
}));

let mockSessions: SessionState[] = [];

// Import after mocking
import { findSessionForPath } from './server.js';

describe('proxy', () => {
  const baseConfig: Config = {
    base_path: '/ttyd-mux',
    base_port: 7600,
    daemon_port: 7680
  };

  beforeEach(() => {
    mockSessions = [];
  });

  describe('findSessionForPath', () => {
    test('returns null when no sessions exist', () => {
      mockSessions = [];

      const result = findSessionForPath(baseConfig, '/ttyd-mux/test/');

      expect(result).toBeNull();
    });

    test('finds session matching path prefix', () => {
      mockSessions = [
        {
          name: 'test-session',
          pid: 12345,
          port: 7601,
          path: '/test',
          dir: '/home/user/test',
          started_at: '2024-01-01T00:00:00Z'
        }
      ];

      const result = findSessionForPath(baseConfig, '/ttyd-mux/test/some/path');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('test-session');
    });

    test('finds session for exact path match', () => {
      mockSessions = [
        {
          name: 'test-session',
          pid: 12345,
          port: 7601,
          path: '/test',
          dir: '/home/user/test',
          started_at: '2024-01-01T00:00:00Z'
        }
      ];

      const result = findSessionForPath(baseConfig, '/ttyd-mux/test');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('test-session');
    });

    test('returns null for non-matching path', () => {
      mockSessions = [
        {
          name: 'test-session',
          pid: 12345,
          port: 7601,
          path: '/test',
          dir: '/home/user/test',
          started_at: '2024-01-01T00:00:00Z'
        }
      ];

      const result = findSessionForPath(baseConfig, '/ttyd-mux/other/path');

      expect(result).toBeNull();
    });

    test('matches correct session among multiple', () => {
      mockSessions = [
        {
          name: 'session-a',
          pid: 12345,
          port: 7601,
          path: '/a',
          dir: '/home/user/a',
          started_at: '2024-01-01T00:00:00Z'
        },
        {
          name: 'session-b',
          pid: 12346,
          port: 7602,
          path: '/b',
          dir: '/home/user/b',
          started_at: '2024-01-01T00:00:00Z'
        }
      ];

      const result = findSessionForPath(baseConfig, '/ttyd-mux/b/ws');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('session-b');
      expect(result?.port).toBe(7602);
    });

    test('handles base_path with trailing slash', () => {
      const configWithSlash: Config = {
        base_path: '/ttyd-mux/',
        base_port: 7600,
        daemon_port: 7680
      };

      mockSessions = [
        {
          name: 'test-session',
          pid: 12345,
          port: 7601,
          path: '/test',
          dir: '/home/user/test',
          started_at: '2024-01-01T00:00:00Z'
        }
      ];

      const result = findSessionForPath(configWithSlash, '/ttyd-mux/test/path');

      expect(result).not.toBeNull();
    });
  });
});
