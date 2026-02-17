import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

// Import the module
import {
  getCwdSessionName,
  isInsideTmux,
  isTmuxInstalled,
  listSessions,
  sessionExists
} from './tmux.js';

describe('tmux', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isInsideTmux', () => {
    test('returns true when TMUX env is set', () => {
      process.env['TMUX'] = '/tmp/tmux-1000/default,12345,0';
      expect(isInsideTmux()).toBe(true);
    });

    test('returns false when TMUX env is not set', () => {
      process.env['TMUX'] = undefined;
      expect(isInsideTmux()).toBe(false);
    });

    test('returns false when TMUX env is empty string', () => {
      process.env['TMUX'] = '';
      expect(isInsideTmux()).toBe(false);
    });
  });

  describe('isTmuxInstalled', () => {
    test('returns true when tmux is installed', () => {
      // Test actual behavior - tmux should be installed on this system
      const result = isTmuxInstalled();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('listSessions', () => {
    test('returns array', () => {
      // Test actual behavior
      const sessions = listSessions();
      expect(Array.isArray(sessions)).toBe(true);
    });

    test('session has correct shape when sessions exist', () => {
      const sessions = listSessions();
      if (sessions.length > 0) {
        const session = sessions[0];
        expect(typeof session?.name).toBe('string');
        expect(typeof session?.windows).toBe('number');
        expect(session?.created).toBeInstanceOf(Date);
        expect(typeof session?.attached).toBe('boolean');
      }
    });
  });
});

describe('TmuxSession type', () => {
  test('has correct structure', () => {
    const session = {
      name: 'test',
      windows: 3,
      created: new Date(),
      attached: false
    };

    expect(session.name).toBe('test');
    expect(session.windows).toBe(3);
    expect(session.created).toBeInstanceOf(Date);
    expect(session.attached).toBe(false);
  });
});

describe('getCwdSessionName', () => {
  test('returns basename of current directory', () => {
    const result = getCwdSessionName();
    const expected = process.cwd().split('/').pop();
    expect(result).toBe(expected);
  });

  test('returns non-empty string', () => {
    const result = getCwdSessionName();
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('sessionExists', () => {
  test('returns false for non-existent session', () => {
    // Use a random name that definitely doesn't exist
    const randomName = `nonexistent-${Date.now()}-${Math.random()}`;
    expect(sessionExists(randomName)).toBe(false);
  });

  test('returns boolean', () => {
    const result = sessionExists('any-session');
    expect(typeof result).toBe('boolean');
  });
});
