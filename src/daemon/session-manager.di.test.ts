import { describe, expect, test } from 'bun:test';
import { type ChildProcess, EventEmitter } from 'node:events';
import { createInMemoryStateStore } from '@/config/state-store.js';
import { createMockProcessRunner } from '@/utils/process-runner.js';
import { createMockTmuxClient } from '@/utils/tmux-client.js';
import { createSessionManager } from './session-manager.js';

/**
 * Create a mock ChildProcess for testing
 */
function createMockChildProcess(pid: number): ChildProcess {
  const emitter = new EventEmitter() as ChildProcess;
  emitter.pid = pid;
  emitter.unref = () => emitter;
  return emitter;
}

describe('SessionManager with DI', () => {
  describe('startSession', () => {
    test('starts a session and saves to state', () => {
      const stateStore = createInMemoryStateStore();
      const mockProcess = createMockChildProcess(12345);
      const processRunner = createMockProcessRunner({
        spawn: () => mockProcess,
        isProcessRunning: () => false
      });
      const tmuxClient = createMockTmuxClient();

      const manager = createSessionManager({ stateStore, processRunner, tmuxClient });

      const session = manager.startSession({
        name: 'test-session',
        dir: '/home/user/project',
        path: '/test',
        port: 7601,
        fullPath: '/ttyd-mux/test'
      });

      expect(session.name).toBe('test-session');
      expect(session.pid).toBe(12345);
      expect(session.port).toBe(7601);
      expect(stateStore.getSession('test-session')).toBeDefined();
    });

    test('throws if session already running', () => {
      const stateStore = createInMemoryStateStore();
      stateStore.addSession({
        name: 'existing',
        pid: 9999,
        port: 7601,
        path: '/existing',
        dir: '/home',
        started_at: '2024-01-01'
      });

      const processRunner = createMockProcessRunner({
        isProcessRunning: (pid) => pid === 9999
      });
      const tmuxClient = createMockTmuxClient();

      const manager = createSessionManager({ stateStore, processRunner, tmuxClient });

      expect(() =>
        manager.startSession({
          name: 'existing',
          dir: '/home',
          path: '/existing',
          port: 7602,
          fullPath: '/ttyd-mux/existing'
        })
      ).toThrow('Session "existing" is already running');
    });

    test('ensures tmux session in auto mode', () => {
      const stateStore = createInMemoryStateStore();
      const mockProcess = createMockChildProcess(12345);
      let ensureSessionCalled = false;

      const processRunner = createMockProcessRunner({
        spawn: () => mockProcess,
        isProcessRunning: () => false
      });
      const tmuxClient = createMockTmuxClient({
        ensureSession: () => {
          ensureSessionCalled = true;
        }
      });

      const manager = createSessionManager({ stateStore, processRunner, tmuxClient });

      manager.startSession({
        name: 'auto-session',
        dir: '/home/user',
        path: '/auto',
        port: 7601,
        fullPath: '/ttyd-mux/auto',
        tmuxMode: 'auto'
      });

      expect(ensureSessionCalled).toBe(true);
    });

    test('does not ensure tmux session in attach mode', () => {
      const stateStore = createInMemoryStateStore();
      const mockProcess = createMockChildProcess(12345);
      let ensureSessionCalled = false;

      const processRunner = createMockProcessRunner({
        spawn: () => mockProcess,
        isProcessRunning: () => false
      });
      const tmuxClient = createMockTmuxClient({
        ensureSession: () => {
          ensureSessionCalled = true;
        }
      });

      const manager = createSessionManager({ stateStore, processRunner, tmuxClient });

      manager.startSession({
        name: 'attach-session',
        dir: '/home/user',
        path: '/attach',
        port: 7601,
        fullPath: '/ttyd-mux/attach',
        tmuxMode: 'attach'
      });

      expect(ensureSessionCalled).toBe(false);
    });

    test('throws if ttyd fails to start (no pid)', () => {
      const stateStore = createInMemoryStateStore();
      const mockProcess = createMockChildProcess(0);
      mockProcess.pid = undefined;

      const processRunner = createMockProcessRunner({
        spawn: () => mockProcess,
        isProcessRunning: () => false
      });
      const tmuxClient = createMockTmuxClient();

      const manager = createSessionManager({ stateStore, processRunner, tmuxClient });

      expect(() =>
        manager.startSession({
          name: 'fail-session',
          dir: '/home',
          path: '/fail',
          port: 7601,
          fullPath: '/ttyd-mux/fail'
        })
      ).toThrow('Failed to start ttyd');
    });

    test('emits session:start event', () => {
      const stateStore = createInMemoryStateStore();
      const mockProcess = createMockChildProcess(12345);
      const processRunner = createMockProcessRunner({
        spawn: () => mockProcess,
        isProcessRunning: () => false
      });
      const tmuxClient = createMockTmuxClient();

      const manager = createSessionManager({ stateStore, processRunner, tmuxClient });

      let emittedSession: unknown = null;
      manager.on('session:start', (session) => {
        emittedSession = session;
      });

      manager.startSession({
        name: 'event-session',
        dir: '/home',
        path: '/event',
        port: 7601,
        fullPath: '/ttyd-mux/event'
      });

      expect(emittedSession).not.toBeNull();
      expect((emittedSession as { name: string }).name).toBe('event-session');
    });
  });

  describe('stopSession', () => {
    test('stops session and removes from state', () => {
      const stateStore = createInMemoryStateStore();
      stateStore.addSession({
        name: 'to-stop',
        pid: 9999,
        port: 7601,
        path: '/stop',
        dir: '/home',
        started_at: '2024-01-01'
      });

      let killedPid: number | null = null;
      const processRunner = createMockProcessRunner({
        kill: (pid) => {
          killedPid = pid;
        }
      });
      const tmuxClient = createMockTmuxClient();

      const manager = createSessionManager({ stateStore, processRunner, tmuxClient });
      manager.stopSession('to-stop');

      expect(killedPid).toBe(9999);
      expect(stateStore.getSession('to-stop')).toBeUndefined();
    });

    test('throws if session not found', () => {
      const stateStore = createInMemoryStateStore();
      const processRunner = createMockProcessRunner();
      const tmuxClient = createMockTmuxClient();

      const manager = createSessionManager({ stateStore, processRunner, tmuxClient });

      expect(() => manager.stopSession('nonexistent')).toThrow('Session "nonexistent" not found');
    });

    test('handles already dead process gracefully', () => {
      const stateStore = createInMemoryStateStore();
      stateStore.addSession({
        name: 'dead-session',
        pid: 9999,
        port: 7601,
        path: '/dead',
        dir: '/home',
        started_at: '2024-01-01'
      });

      const processRunner = createMockProcessRunner({
        kill: () => {
          throw new Error('ESRCH: no such process');
        }
      });
      const tmuxClient = createMockTmuxClient();

      const manager = createSessionManager({ stateStore, processRunner, tmuxClient });

      // Should not throw - graceful handling of dead process
      expect(() => manager.stopSession('dead-session')).not.toThrow();
      expect(stateStore.getSession('dead-session')).toBeUndefined();
    });

    test('emits session:stop event', () => {
      const stateStore = createInMemoryStateStore();
      stateStore.addSession({
        name: 'event-stop',
        pid: 9999,
        port: 7601,
        path: '/stop',
        dir: '/home',
        started_at: '2024-01-01'
      });

      const processRunner = createMockProcessRunner({
        kill: () => {
          /* no-op */
        }
      });
      const tmuxClient = createMockTmuxClient();

      const manager = createSessionManager({ stateStore, processRunner, tmuxClient });

      let emittedName: string | null = null;
      manager.on('session:stop', (name) => {
        emittedName = name;
      });

      manager.stopSession('event-stop');

      expect(emittedName).toBe('event-stop');
    });
  });

  describe('listSessions', () => {
    test('returns only sessions with running processes', () => {
      const stateStore = createInMemoryStateStore();
      stateStore.addSession({
        name: 'running',
        pid: 1111,
        port: 7601,
        path: '/running',
        dir: '/home',
        started_at: '2024-01-01'
      });
      stateStore.addSession({
        name: 'dead',
        pid: 2222,
        port: 7602,
        path: '/dead',
        dir: '/home',
        started_at: '2024-01-01'
      });

      const processRunner = createMockProcessRunner({
        isProcessRunning: (pid) => pid === 1111
      });
      const tmuxClient = createMockTmuxClient();

      const manager = createSessionManager({ stateStore, processRunner, tmuxClient });
      const sessions = manager.listSessions();

      expect(sessions.length).toBe(1);
      expect(sessions[0].name).toBe('running');
      // Dead session should be removed from state
      expect(stateStore.getSession('dead')).toBeUndefined();
    });
  });

  describe('stopAllSessions', () => {
    test('stops all running sessions', () => {
      const stateStore = createInMemoryStateStore();
      stateStore.addSession({
        name: 'session1',
        pid: 1111,
        port: 7601,
        path: '/s1',
        dir: '/home',
        started_at: '2024-01-01'
      });
      stateStore.addSession({
        name: 'session2',
        pid: 2222,
        port: 7602,
        path: '/s2',
        dir: '/home',
        started_at: '2024-01-01'
      });

      const killedPids: number[] = [];
      const processRunner = createMockProcessRunner({
        isProcessRunning: () => true,
        kill: (pid) => {
          killedPids.push(pid);
        }
      });
      const tmuxClient = createMockTmuxClient();

      const manager = createSessionManager({ stateStore, processRunner, tmuxClient });
      manager.stopAllSessions();

      expect(killedPids).toContain(1111);
      expect(killedPids).toContain(2222);
      expect(stateStore.getAllSessions().length).toBe(0);
    });
  });

  describe('isProcessRunning', () => {
    test('delegates to processRunner', () => {
      const stateStore = createInMemoryStateStore();
      const processRunner = createMockProcessRunner({
        isProcessRunning: (pid) => pid === 12345
      });
      const tmuxClient = createMockTmuxClient();

      const manager = createSessionManager({ stateStore, processRunner, tmuxClient });

      expect(manager.isProcessRunning(12345)).toBe(true);
      expect(manager.isProcessRunning(99999)).toBe(false);
    });
  });
});
