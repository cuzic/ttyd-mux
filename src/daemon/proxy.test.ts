// Import test setup FIRST to set environment variables before any other imports
import { cleanupTestState, resetTestState } from '@/test-setup.js';

import { afterAll, beforeEach, describe, expect, test } from 'bun:test';
import { addSession } from '@/config/state.js';
import type { Config } from '@/config/types.js';
import { findSessionForPath } from './router.js';

describe('proxy', () => {
  const baseConfig: Config = {
    base_path: '/ttyd-mux',
    base_port: 7600,
    daemon_port: 7680
  };

  beforeEach(() => {
    resetTestState();
  });

  afterAll(() => {
    cleanupTestState();
  });

  describe('findSessionForPath', () => {
    test('returns null when no sessions exist', () => {
      const result = findSessionForPath(baseConfig, '/ttyd-mux/test/');

      expect(result).toBeNull();
    });

    test('finds session matching path prefix', () => {
      addSession({
        name: 'test-session',
        pid: process.pid, // Use current process PID so session is "alive"
        port: 7601,
        path: '/test',
        dir: '/home/user/test',
        started_at: '2024-01-01T00:00:00Z'
      });

      const result = findSessionForPath(baseConfig, '/ttyd-mux/test/some/path');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('test-session');
    });

    test('finds session for exact path match', () => {
      addSession({
        name: 'test-session',
        pid: process.pid,
        port: 7601,
        path: '/test',
        dir: '/home/user/test',
        started_at: '2024-01-01T00:00:00Z'
      });

      const result = findSessionForPath(baseConfig, '/ttyd-mux/test');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('test-session');
    });

    test('returns null for non-matching path', () => {
      addSession({
        name: 'test-session',
        pid: process.pid,
        port: 7601,
        path: '/test',
        dir: '/home/user/test',
        started_at: '2024-01-01T00:00:00Z'
      });

      const result = findSessionForPath(baseConfig, '/ttyd-mux/other/path');

      expect(result).toBeNull();
    });

    test('matches correct session among multiple', () => {
      addSession({
        name: 'session-a',
        pid: process.pid,
        port: 7601,
        path: '/a',
        dir: '/home/user/a',
        started_at: '2024-01-01T00:00:00Z'
      });
      addSession({
        name: 'session-b',
        pid: process.pid,
        port: 7602,
        path: '/b',
        dir: '/home/user/b',
        started_at: '2024-01-01T00:00:00Z'
      });

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

      addSession({
        name: 'test-session',
        pid: process.pid,
        port: 7601,
        path: '/test',
        dir: '/home/user/test',
        started_at: '2024-01-01T00:00:00Z'
      });

      const result = findSessionForPath(configWithSlash, '/ttyd-mux/test/path');

      expect(result).not.toBeNull();
    });
  });
});
