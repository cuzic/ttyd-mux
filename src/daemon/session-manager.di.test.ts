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
    test('starts a session and saves to state', async () => {
      const stateStore = createInMemoryStateStore();
      const mockProcess = createMockChildProcess(12345);
      const processRunner = createMockProcessRunner({
        spawn: () => mockProcess,
        isProcessRunning: () => false
      });
      const tmuxClient = createMockTmuxClient();

      const manager = createSessionManager({ stateStore, processRunner, tmuxClient });

      const session = await manager.startSession({
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

    test('throws if session already running', async () => {
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

      await expect(
        manager.startSession({
          name: 'existing',
          dir: '/home',
          path: '/existing',
          port: 7602,
          fullPath: '/ttyd-mux/existing'
        })
      ).rejects.toThrow('Session "existing" is already running');
    });

    test('throws if port is already in use', async () => {
      const stateStore = createInMemoryStateStore();
      const mockProcess = createMockChildProcess(12345);
      const processRunner = createMockProcessRunner({
        spawn: () => mockProcess,
        isProcessRunning: () => false,
        isPortAvailable: () => Promise.resolve(false)
      });
      const tmuxClient = createMockTmuxClient();

      const manager = createSessionManager({ stateStore, processRunner, tmuxClient });

      await expect(
        manager.startSession({
          name: 'test-session',
          dir: '/home/user/project',
          path: '/test',
          port: 7601,
          fullPath: '/ttyd-mux/test'
        })
      ).rejects.toThrow('Port 7601 is already in use');
    });

    test('ensures tmux session in auto mode', async () => {
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

      await manager.startSession({
        name: 'auto-session',
        dir: '/home/user',
        path: '/auto',
        port: 7601,
        fullPath: '/ttyd-mux/auto',
        tmuxMode: 'auto'
      });

      expect(ensureSessionCalled).toBe(true);
    });

    test('does not ensure tmux session in attach mode', async () => {
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

      await manager.startSession({
        name: 'attach-session',
        dir: '/home/user',
        path: '/attach',
        port: 7601,
        fullPath: '/ttyd-mux/attach',
        tmuxMode: 'attach'
      });

      expect(ensureSessionCalled).toBe(false);
    });

    test('throws if ttyd fails to start (no pid)', async () => {
      const stateStore = createInMemoryStateStore();
      const mockProcess = createMockChildProcess(0);
      mockProcess.pid = undefined;

      const processRunner = createMockProcessRunner({
        spawn: () => mockProcess,
        isProcessRunning: () => false
      });
      const tmuxClient = createMockTmuxClient();

      const manager = createSessionManager({ stateStore, processRunner, tmuxClient });

      await expect(
        manager.startSession({
          name: 'fail-session',
          dir: '/home',
          path: '/fail',
          port: 7601,
          fullPath: '/ttyd-mux/fail'
        })
      ).rejects.toThrow('Failed to start ttyd');
    });

    test('emits session:start event', async () => {
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

      await manager.startSession({
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

  describe('revalidateSessions', () => {
    test('keeps valid sessions and removes dead ones', () => {
      const stateStore = createInMemoryStateStore();
      stateStore.addSession({
        name: 'alive',
        pid: 1111,
        port: 7601,
        path: '/alive',
        dir: '/home/alive',
        started_at: '2024-01-01'
      });
      stateStore.addSession({
        name: 'dead',
        pid: 2222,
        port: 7602,
        path: '/dead',
        dir: '/home/dead',
        started_at: '2024-01-01'
      });

      const processRunner = createMockProcessRunner({
        isProcessRunning: (pid) => pid === 1111
      });
      const tmuxClient = createMockTmuxClient();

      const manager = createSessionManager({ stateStore, processRunner, tmuxClient });
      const result = manager.revalidateSessions();

      expect(result.valid.length).toBe(1);
      expect(result.valid[0].name).toBe('alive');
      expect(result.removed).toEqual(['dead']);
      expect(stateStore.getSession('alive')).toBeDefined();
      expect(stateStore.getSession('dead')).toBeUndefined();
    });

    test('returns empty arrays when no sessions exist', () => {
      const stateStore = createInMemoryStateStore();
      const processRunner = createMockProcessRunner();
      const tmuxClient = createMockTmuxClient();

      const manager = createSessionManager({ stateStore, processRunner, tmuxClient });
      const result = manager.revalidateSessions();

      expect(result.valid).toEqual([]);
      expect(result.removed).toEqual([]);
    });

    test('keeps all sessions when all are alive', () => {
      const stateStore = createInMemoryStateStore();
      stateStore.addSession({
        name: 'session1',
        pid: 1111,
        port: 7601,
        path: '/s1',
        dir: '/home/s1',
        started_at: '2024-01-01'
      });
      stateStore.addSession({
        name: 'session2',
        pid: 2222,
        port: 7602,
        path: '/s2',
        dir: '/home/s2',
        started_at: '2024-01-01'
      });

      const processRunner = createMockProcessRunner({
        isProcessRunning: () => true
      });
      const tmuxClient = createMockTmuxClient();

      const manager = createSessionManager({ stateStore, processRunner, tmuxClient });
      const result = manager.revalidateSessions();

      expect(result.valid.length).toBe(2);
      expect(result.removed).toEqual([]);
    });

    test('removes all sessions when all are dead', () => {
      const stateStore = createInMemoryStateStore();
      stateStore.addSession({
        name: 'dead1',
        pid: 1111,
        port: 7601,
        path: '/d1',
        dir: '/home/d1',
        started_at: '2024-01-01'
      });
      stateStore.addSession({
        name: 'dead2',
        pid: 2222,
        port: 7602,
        path: '/d2',
        dir: '/home/d2',
        started_at: '2024-01-01'
      });

      const processRunner = createMockProcessRunner({
        isProcessRunning: () => false
      });
      const tmuxClient = createMockTmuxClient();

      const manager = createSessionManager({ stateStore, processRunner, tmuxClient });
      const result = manager.revalidateSessions();

      expect(result.valid).toEqual([]);
      expect(result.removed).toEqual(['dead1', 'dead2']);
      expect(stateStore.getAllSessions().length).toBe(0);
    });

    test('preserves session data correctly for valid sessions', () => {
      const stateStore = createInMemoryStateStore();
      const sessionData = {
        name: 'preserved',
        pid: 1111,
        port: 7601,
        path: '/preserved',
        dir: '/home/preserved',
        started_at: '2024-01-01T12:00:00Z'
      };
      stateStore.addSession(sessionData);

      const processRunner = createMockProcessRunner({
        isProcessRunning: () => true
      });
      const tmuxClient = createMockTmuxClient();

      const manager = createSessionManager({ stateStore, processRunner, tmuxClient });
      const result = manager.revalidateSessions();

      expect(result.valid.length).toBe(1);
      expect(result.valid[0]).toEqual(sessionData);
      expect(result.valid[0].started_at).toBe('2024-01-01T12:00:00Z');
    });

    test('does not affect runningProcesses map', () => {
      const stateStore = createInMemoryStateStore();
      stateStore.addSession({
        name: 'session1',
        pid: 1111,
        port: 7601,
        path: '/s1',
        dir: '/home/s1',
        started_at: '2024-01-01'
      });

      const processRunner = createMockProcessRunner({
        isProcessRunning: () => true
      });
      const tmuxClient = createMockTmuxClient();

      const manager = createSessionManager({ stateStore, processRunner, tmuxClient });

      // Revalidate should not crash even without ChildProcess handles
      const result = manager.revalidateSessions();

      expect(result.valid.length).toBe(1);
      // Session should still be listable after revalidation
      const sessions = manager.listSessions();
      expect(sessions.length).toBe(1);
    });
  });

  describe('session persistence scenarios', () => {
    test('simulates daemon restart with surviving sessions', () => {
      // Simulate state from previous daemon
      const stateStore = createInMemoryStateStore();
      stateStore.addSession({
        name: 'surviving-session',
        pid: 12345,
        port: 7601,
        path: '/surviving',
        dir: '/home/user/project',
        started_at: '2024-01-01T10:00:00Z'
      });

      // New daemon starts with process still running
      const processRunner = createMockProcessRunner({
        isProcessRunning: (pid) => pid === 12345
      });
      const tmuxClient = createMockTmuxClient();

      const manager = createSessionManager({ stateStore, processRunner, tmuxClient });

      // Revalidate on startup
      const result = manager.revalidateSessions();

      expect(result.valid.length).toBe(1);
      expect(result.valid[0].name).toBe('surviving-session');
      expect(result.removed.length).toBe(0);

      // Session should be accessible
      const sessions = manager.listSessions();
      expect(sessions.length).toBe(1);
      expect(sessions[0].name).toBe('surviving-session');
    });

    test('simulates daemon restart with crashed sessions', () => {
      // Simulate state from previous daemon with crashed session
      const stateStore = createInMemoryStateStore();
      stateStore.addSession({
        name: 'crashed-session',
        pid: 99999,
        port: 7601,
        path: '/crashed',
        dir: '/home/user/project',
        started_at: '2024-01-01T10:00:00Z'
      });

      // Process is no longer running
      const processRunner = createMockProcessRunner({
        isProcessRunning: () => false
      });
      const tmuxClient = createMockTmuxClient();

      const manager = createSessionManager({ stateStore, processRunner, tmuxClient });

      // Revalidate on startup
      const result = manager.revalidateSessions();

      expect(result.valid.length).toBe(0);
      expect(result.removed).toEqual(['crashed-session']);

      // Session should be removed from state
      expect(stateStore.getSession('crashed-session')).toBeUndefined();
    });

    test('simulates mixed scenario with some surviving and some crashed', () => {
      const stateStore = createInMemoryStateStore();
      stateStore.addSession({
        name: 'alive1',
        pid: 1001,
        port: 7601,
        path: '/alive1',
        dir: '/home/a1',
        started_at: '2024-01-01'
      });
      stateStore.addSession({
        name: 'dead1',
        pid: 2001,
        port: 7602,
        path: '/dead1',
        dir: '/home/d1',
        started_at: '2024-01-01'
      });
      stateStore.addSession({
        name: 'alive2',
        pid: 1002,
        port: 7603,
        path: '/alive2',
        dir: '/home/a2',
        started_at: '2024-01-01'
      });
      stateStore.addSession({
        name: 'dead2',
        pid: 2002,
        port: 7604,
        path: '/dead2',
        dir: '/home/d2',
        started_at: '2024-01-01'
      });

      const processRunner = createMockProcessRunner({
        isProcessRunning: (pid) => pid === 1001 || pid === 1002
      });
      const tmuxClient = createMockTmuxClient();

      const manager = createSessionManager({ stateStore, processRunner, tmuxClient });
      const result = manager.revalidateSessions();

      expect(result.valid.length).toBe(2);
      expect(result.valid.map((s) => s.name).sort()).toEqual(['alive1', 'alive2']);
      expect(result.removed.sort()).toEqual(['dead1', 'dead2']);

      // Verify state is correct
      expect(stateStore.getSession('alive1')).toBeDefined();
      expect(stateStore.getSession('alive2')).toBeDefined();
      expect(stateStore.getSession('dead1')).toBeUndefined();
      expect(stateStore.getSession('dead2')).toBeUndefined();
    });

    test('can start new session after revalidation', async () => {
      const stateStore = createInMemoryStateStore();
      stateStore.addSession({
        name: 'existing',
        pid: 1111,
        port: 7601,
        path: '/existing',
        dir: '/home/existing',
        started_at: '2024-01-01'
      });

      const mockProcess = createMockChildProcess(2222);
      const processRunner = createMockProcessRunner({
        isProcessRunning: (pid) => pid === 1111 || pid === 2222,
        spawn: () => mockProcess
      });
      const tmuxClient = createMockTmuxClient();

      const manager = createSessionManager({ stateStore, processRunner, tmuxClient });

      // Revalidate first
      manager.revalidateSessions();

      // Start a new session
      const newSession = await manager.startSession({
        name: 'new-session',
        dir: '/home/new',
        path: '/new',
        port: 7602,
        fullPath: '/ttyd-mux/new'
      });

      expect(newSession.name).toBe('new-session');
      expect(newSession.pid).toBe(2222);

      // Both sessions should be listed
      const sessions = manager.listSessions();
      expect(sessions.length).toBe(2);
    });

    test('can stop revalidated session', () => {
      const stateStore = createInMemoryStateStore();
      stateStore.addSession({
        name: 'to-stop',
        pid: 1111,
        port: 7601,
        path: '/stop',
        dir: '/home/stop',
        started_at: '2024-01-01'
      });

      let killedPid: number | null = null;
      const processRunner = createMockProcessRunner({
        isProcessRunning: (pid) => pid === 1111 && killedPid !== 1111,
        kill: (pid) => {
          killedPid = pid;
        }
      });
      const tmuxClient = createMockTmuxClient();

      const manager = createSessionManager({ stateStore, processRunner, tmuxClient });

      // Revalidate first
      manager.revalidateSessions();

      // Stop the session
      manager.stopSession('to-stop');

      expect(killedPid).toBe(1111);
      expect(stateStore.getSession('to-stop')).toBeUndefined();
    });
  });
});
