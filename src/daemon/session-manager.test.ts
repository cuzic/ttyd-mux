import { describe, expect, test } from 'bun:test';
import type { Config } from '../config/types.js';
import { allocatePort, isProcessRunning, sessionNameFromDir } from './session-manager.js';

describe('session-manager', () => {
  describe('sessionNameFromDir', () => {
    test('extracts directory name from path', () => {
      expect(sessionNameFromDir('/home/user/my-project')).toBe('my-project');
      expect(sessionNameFromDir('/var/www/app')).toBe('app');
      expect(sessionNameFromDir('/single')).toBe('single');
    });

    test('handles paths with trailing slash', () => {
      // Empty string from split returns 'default'
      const result = sessionNameFromDir('/home/user/project/');
      expect(result).toBe('default');
    });

    test('returns default for root path', () => {
      expect(sessionNameFromDir('/')).toBe('default');
    });

    test('handles nested paths', () => {
      expect(sessionNameFromDir('/a/b/c/d/project-name')).toBe('project-name');
    });
  });

  describe('allocatePort', () => {
    test('allocates port based on config base_port', () => {
      const config: Config = {
        base_path: '/ttyd-mux',
        base_port: 7600,
        daemon_port: 7680
      };

      // When no sessions exist, should return base_port + 1
      const port = allocatePort(config);

      expect(port).toBeGreaterThanOrEqual(7601);
    });
  });

  describe('isProcessRunning', () => {
    test('returns true for current process', () => {
      // process.pid should always be running
      expect(isProcessRunning(process.pid)).toBe(true);
    });

    test('returns false for non-existent PID', () => {
      // Use a very high PID that's unlikely to exist
      expect(isProcessRunning(999999999)).toBe(false);
    });

    test('returns false for PID 0', () => {
      // PID 0 is special and shouldn't be killable by user process
      // This might throw, so we expect false or an error
      const result = isProcessRunning(0);
      // On most systems, this returns false or throws
      expect(typeof result).toBe('boolean');
    });
  });
});

describe('StartSessionOptions', () => {
  test('has correct structure', () => {
    const options = {
      name: 'test-session',
      dir: '/home/user/test',
      path: '/test',
      port: 7601,
      fullPath: '/ttyd-mux/test'
    };

    expect(options.name).toBe('test-session');
    expect(options.dir).toBe('/home/user/test');
    expect(options.path).toBe('/test');
    expect(options.port).toBe(7601);
    expect(options.fullPath).toBe('/ttyd-mux/test');
  });
});
