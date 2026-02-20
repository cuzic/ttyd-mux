import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TEST_CONFIG_DIR } from '../test-setup.js';
import { findSessionDefinition, getFullPath, getSessionPort, loadConfig } from './config.js';

// Top-level regex patterns for linter compliance
const FAILED_TO_LOAD_CONFIG_REGEX = /Failed to load config/;

describe('config', () => {
  beforeEach(() => {
    if (existsSync(TEST_CONFIG_DIR)) {
      rmSync(TEST_CONFIG_DIR, { recursive: true });
    }
    mkdirSync(TEST_CONFIG_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_CONFIG_DIR)) {
      rmSync(TEST_CONFIG_DIR, { recursive: true });
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
      const configPath = join(TEST_CONFIG_DIR, 'config.yaml');
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
      expect(config.sessions[0].name).toBe('test-session');
    });

    test('uses defaults for missing fields', () => {
      const configPath = join(TEST_CONFIG_DIR, 'partial.yaml');
      writeFileSync(configPath, 'base_port: 9000\n');

      const config = loadConfig(configPath);

      expect(config.base_path).toBe('/ttyd-mux');
      expect(config.base_port).toBe(9000);
      expect(config.daemon_port).toBe(7680);
    });

    test('loads listen_sockets configuration', () => {
      const configPath = join(TEST_CONFIG_DIR, 'sockets.yaml');
      const yaml = `
listen_sockets:
  - /run/ttyd-mux.sock
  - /tmp/ttyd-mux-alt.sock
`;
      writeFileSync(configPath, yaml);

      const config = loadConfig(configPath);

      expect(config.listen_sockets).toHaveLength(2);
      expect(config.listen_sockets[0]).toBe('/run/ttyd-mux.sock');
      expect(config.listen_sockets[1]).toBe('/tmp/ttyd-mux-alt.sock');
    });

    test('defaults listen_sockets to empty array', () => {
      const config = loadConfig();

      expect(config.listen_sockets).toEqual([]);
    });

    test('loads toolbar configuration', () => {
      const configPath = join(TEST_CONFIG_DIR, 'toolbar.yaml');
      const yaml = `
toolbar:
  font_size_default_mobile: 28
  font_size_default_pc: 16
  font_size_min: 8
  font_size_max: 64
  double_tap_delay: 400
`;
      writeFileSync(configPath, yaml);

      const config = loadConfig(configPath);

      expect(config.toolbar.font_size_default_mobile).toBe(28);
      expect(config.toolbar.font_size_default_pc).toBe(16);
      expect(config.toolbar.font_size_min).toBe(8);
      expect(config.toolbar.font_size_max).toBe(64);
      expect(config.toolbar.double_tap_delay).toBe(400);
    });

    test('defaults toolbar to default values', () => {
      const config = loadConfig();

      expect(config.toolbar.font_size_default_mobile).toBe(32);
      expect(config.toolbar.font_size_default_pc).toBe(14);
      expect(config.toolbar.font_size_min).toBe(10);
      expect(config.toolbar.font_size_max).toBe(48);
      expect(config.toolbar.double_tap_delay).toBe(300);
    });

    test('partially overrides toolbar defaults', () => {
      const configPath = join(TEST_CONFIG_DIR, 'toolbar-partial.yaml');
      const yaml = `
toolbar:
  font_size_default_mobile: 36
`;
      writeFileSync(configPath, yaml);

      const config = loadConfig(configPath);

      expect(config.toolbar.font_size_default_mobile).toBe(36);
      expect(config.toolbar.font_size_default_pc).toBe(14); // default
      expect(config.toolbar.font_size_min).toBe(10); // default
    });

    test('error message includes hint for YAML parse errors', () => {
      const configPath = join(TEST_CONFIG_DIR, 'bad-yaml.yaml');
      writeFileSync(configPath, '{ invalid yaml content');

      expect(() => loadConfig(configPath)).toThrow(FAILED_TO_LOAD_CONFIG_REGEX);
    });

    test('error message includes hint for Zod validation errors', () => {
      const configPath = join(TEST_CONFIG_DIR, 'invalid-type.yaml');
      writeFileSync(configPath, 'base_port: not-a-number\n');

      expect(() => loadConfig(configPath)).toThrow(FAILED_TO_LOAD_CONFIG_REGEX);
    });

    test('throws on invalid yaml', () => {
      const configPath = join(TEST_CONFIG_DIR, 'invalid.yaml');
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

    test('returns undefined when sessions array is empty', () => {
      const config = { base_path: '/', base_port: 7600, daemon_port: 7680, sessions: [] };

      const found = findSessionDefinition(config, 'any');

      expect(found).toBeUndefined();
    });
  });
});
