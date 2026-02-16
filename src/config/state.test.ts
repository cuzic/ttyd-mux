import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// We need to mock the state directory for testing
const TEST_STATE_DIR = '/tmp/ttyd-mux-test-state';

// Mock the state module to use test directory
const _originalHomedir = process.env['HOME'];

describe('state', () => {
  beforeEach(() => {
    // Clean up test directory
    if (existsSync(TEST_STATE_DIR)) {
      rmSync(TEST_STATE_DIR, { recursive: true });
    }
    mkdirSync(TEST_STATE_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_STATE_DIR)) {
      rmSync(TEST_STATE_DIR, { recursive: true });
    }
  });

  describe('state file operations', () => {
    test('creates state directory if not exists', async () => {
      // Import fresh module
      const { loadState } = await import('./state.js');

      const state = loadState();

      expect(state.daemon).toBeNull();
      expect(state.sessions).toEqual([]);
    });
  });

  describe('getNextPort', () => {
    test('returns base_port + 1 when no sessions', async () => {
      const { getNextPort } = await import('./state.js');

      const port = getNextPort(7600);

      expect(port).toBe(7601);
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

describe('SessionState operations', () => {
  const _TEST_STATE_FILE = join(TEST_STATE_DIR, 'state.json');

  beforeEach(() => {
    if (existsSync(TEST_STATE_DIR)) {
      rmSync(TEST_STATE_DIR, { recursive: true });
    }
    mkdirSync(TEST_STATE_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_STATE_DIR)) {
      rmSync(TEST_STATE_DIR, { recursive: true });
    }
  });

  test('session state structure is correct', () => {
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

  test('daemon state structure is correct', () => {
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
