import { afterEach, describe, expect, test } from 'bun:test';
import { createMockProcessRunner } from './process-runner.js';
import { createMockTmuxClient, createTmuxClient } from './tmux-client.js';

describe('createTmuxClient', () => {
  const originalEnv = process.env['TMUX'];

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env['TMUX'] = originalEnv;
    } else {
      process.env['TMUX'] = undefined;
    }
  });

  describe('isInsideTmux', () => {
    test('returns true when TMUX env is set', () => {
      process.env['TMUX'] = '/tmp/tmux-1000/default,12345,0';
      const client = createTmuxClient();
      expect(client.isInsideTmux()).toBe(true);
    });

    test('returns false when TMUX env is not set', () => {
      process.env['TMUX'] = undefined;
      const client = createTmuxClient();
      expect(client.isInsideTmux()).toBe(false);
    });
  });

  describe('isInstalled', () => {
    test('returns true when tmux is found', () => {
      const mockRunner = createMockProcessRunner({
        execSync: () => '/usr/bin/tmux'
      });
      const client = createTmuxClient(mockRunner);
      expect(client.isInstalled()).toBe(true);
    });

    test('returns false when tmux is not found', () => {
      const mockRunner = createMockProcessRunner({
        execSync: () => {
          throw new Error('not found');
        }
      });
      const client = createTmuxClient(mockRunner);
      expect(client.isInstalled()).toBe(false);
    });
  });

  describe('listSessions', () => {
    test('parses tmux session list output', () => {
      const mockRunner = createMockProcessRunner({
        execSync: () => 'session1|3|1704067200|0\nsession2|1|1704153600|1\n'
      });
      const client = createTmuxClient(mockRunner);
      const sessions = client.listSessions();

      expect(sessions.length).toBe(2);
      expect(sessions[0].name).toBe('session1');
      expect(sessions[0].windows).toBe(3);
      expect(sessions[0].attached).toBe(false);
      expect(sessions[1].name).toBe('session2');
      expect(sessions[1].windows).toBe(1);
      expect(sessions[1].attached).toBe(true);
    });

    test('returns empty array when no sessions', () => {
      const mockRunner = createMockProcessRunner({
        execSync: () => {
          throw new Error('no server running');
        }
      });
      const client = createTmuxClient(mockRunner);
      expect(client.listSessions()).toEqual([]);
    });

    test('filters empty lines', () => {
      const mockRunner = createMockProcessRunner({
        execSync: () => 'session1|1|1704067200|0\n\n'
      });
      const client = createTmuxClient(mockRunner);
      const sessions = client.listSessions();
      expect(sessions.length).toBe(1);
    });
  });

  describe('sessionExists', () => {
    test('returns true when session exists', () => {
      const mockRunner = createMockProcessRunner({
        execSync: () => ''
      });
      const client = createTmuxClient(mockRunner);
      expect(client.sessionExists('my-session')).toBe(true);
    });

    test('returns false when session does not exist', () => {
      const mockRunner = createMockProcessRunner({
        execSync: () => {
          throw new Error('session not found');
        }
      });
      const client = createTmuxClient(mockRunner);
      expect(client.sessionExists('nonexistent')).toBe(false);
    });
  });

  describe('ensureSession', () => {
    test('creates session if it does not exist', () => {
      let createCalled = false;
      let hasSessionCalls = 0;

      const mockRunner = createMockProcessRunner({
        execSync: (cmd: string) => {
          if (cmd.includes('has-session')) {
            hasSessionCalls++;
            throw new Error('session not found');
          }
          if (cmd.includes('new-session')) {
            createCalled = true;
            return '';
          }
          return '';
        }
      });

      const client = createTmuxClient(mockRunner);
      client.ensureSession('new-session');

      expect(hasSessionCalls).toBe(1);
      expect(createCalled).toBe(true);
    });

    test('does not create session if it already exists', () => {
      let createCalled = false;

      const mockRunner = createMockProcessRunner({
        execSync: (cmd: string) => {
          if (cmd.includes('has-session')) {
            return ''; // Session exists
          }
          if (cmd.includes('new-session')) {
            createCalled = true;
          }
          return '';
        }
      });

      const client = createTmuxClient(mockRunner);
      client.ensureSession('existing-session');

      expect(createCalled).toBe(false);
    });

    test('passes cwd option when creating session', () => {
      let createCommand = '';

      const mockRunner = createMockProcessRunner({
        execSync: (cmd: string) => {
          if (cmd.includes('has-session')) {
            throw new Error('session not found');
          }
          if (cmd.includes('new-session')) {
            createCommand = cmd;
          }
          return '';
        }
      });

      const client = createTmuxClient(mockRunner);
      client.ensureSession('new-session', '/home/user/project');

      expect(createCommand).toContain('-c "/home/user/project"');
    });
  });
});

describe('createMockTmuxClient', () => {
  test('provides default mock implementations', () => {
    const mock = createMockTmuxClient();
    expect(mock.isInsideTmux()).toBe(false);
    expect(mock.isInstalled()).toBe(true);
    expect(mock.listSessions()).toEqual([]);
    expect(mock.sessionExists('any')).toBe(false);
    // ensureSession should not throw
    expect(() => mock.ensureSession('test')).not.toThrow();
  });

  test('allows overriding methods', () => {
    const mock = createMockTmuxClient({
      isInsideTmux: () => true,
      listSessions: () => [{ name: 'test', windows: 1, created: new Date(), attached: false }]
    });
    expect(mock.isInsideTmux()).toBe(true);
    expect(mock.listSessions().length).toBe(1);
  });
});
