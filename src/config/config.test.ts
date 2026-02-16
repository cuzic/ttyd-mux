import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findSessionDefinition, getFullPath, getSessionPort, loadConfig } from './config.js';

const TEST_DIR = '/tmp/ttyd-mux-test-config';

describe('config', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('loadConfig', () => {
    test('returns default config when no config path provided', () => {
      // loadConfig() without argument should return defaults if no config file found
      const config = loadConfig();

      expect(config.base_path).toBe('/ttyd-mux');
      expect(config.base_port).toBe(7600);
      expect(config.daemon_port).toBe(7680);
    });

    test('throws when specified config file does not exist', () => {
      expect(() => loadConfig('/nonexistent/path.yaml')).toThrow();
    });

    test('loads config from yaml file', () => {
      const configPath = join(TEST_DIR, 'config.yaml');
      const yaml = `
base_path: /custom-path
base_port: 8000
daemon_port: 9000
sessions:
  - name: test-session
    dir: /home/test
    path: /test
    port_offset: 1
`;
      writeFileSync(configPath, yaml);

      const config = loadConfig(configPath);

      expect(config.base_path).toBe('/custom-path');
      expect(config.base_port).toBe(8000);
      expect(config.daemon_port).toBe(9000);
      expect(config.sessions).toHaveLength(1);
      expect(config.sessions?.[0]?.name).toBe('test-session');
    });

    test('uses defaults for missing fields', () => {
      const configPath = join(TEST_DIR, 'partial.yaml');
      writeFileSync(configPath, 'base_port: 9000\n');

      const config = loadConfig(configPath);

      expect(config.base_path).toBe('/ttyd-mux');
      expect(config.base_port).toBe(9000);
      expect(config.daemon_port).toBe(7680);
    });

    test('throws on invalid yaml', () => {
      const configPath = join(TEST_DIR, 'invalid.yaml');
      writeFileSync(configPath, '{ invalid yaml content');

      expect(() => loadConfig(configPath)).toThrow();
    });
  });

  describe('getSessionPort', () => {
    test('calculates port from base_port and offset', () => {
      const config = { base_path: '/', base_port: 7600, daemon_port: 7680 };

      expect(getSessionPort(config, 1)).toBe(7601);
      expect(getSessionPort(config, 5)).toBe(7605);
      expect(getSessionPort(config, 0)).toBe(7600);
    });
  });

  describe('getFullPath', () => {
    test('combines base_path and session path', () => {
      const config = { base_path: '/ttyd-mux', base_port: 7600, daemon_port: 7680 };

      expect(getFullPath(config, '/seminar')).toBe('/ttyd-mux/seminar');
      expect(getFullPath(config, '/room1')).toBe('/ttyd-mux/room1');
    });

    test('handles base_path with trailing slash', () => {
      const config = { base_path: '/ttyd-mux/', base_port: 7600, daemon_port: 7680 };

      expect(getFullPath(config, '/seminar')).toBe('/ttyd-mux/seminar');
    });

    test('handles session path without leading slash', () => {
      const config = { base_path: '/ttyd-mux', base_port: 7600, daemon_port: 7680 };

      expect(getFullPath(config, 'seminar')).toBe('/ttyd-mux/seminar');
    });
  });

  describe('findSessionDefinition', () => {
    test('finds session by name', () => {
      const config = {
        base_path: '/',
        base_port: 7600,
        daemon_port: 7680,
        sessions: [
          { name: 'session-a', dir: '/a', path: '/a', port_offset: 1 },
          { name: 'session-b', dir: '/b', path: '/b', port_offset: 2 }
        ]
      };

      const found = findSessionDefinition(config, 'session-b');

      expect(found).toBeDefined();
      expect(found?.name).toBe('session-b');
      expect(found?.dir).toBe('/b');
    });

    test('returns undefined for non-existent session', () => {
      const config = {
        base_path: '/',
        base_port: 7600,
        daemon_port: 7680,
        sessions: [{ name: 'session-a', dir: '/a', path: '/a', port_offset: 1 }]
      };

      const found = findSessionDefinition(config, 'non-existent');

      expect(found).toBeUndefined();
    });

    test('returns undefined when sessions is undefined', () => {
      const config = { base_path: '/', base_port: 7600, daemon_port: 7680 };

      const found = findSessionDefinition(config, 'any');

      expect(found).toBeUndefined();
    });
  });
});
