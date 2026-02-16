import { type ChildProcess, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import {
  addSession,
  getAllSessions,
  getNextPort,
  getSession,
  removeSession
} from '../config/state.js';
import type { Config, SessionState } from '../config/types.js';

export interface StartSessionOptions {
  name: string;
  dir: string;
  path: string;
  port: number;
  fullPath: string;
}

export interface SessionEvents {
  'session:start': (session: SessionState) => void;
  'session:stop': (name: string) => void;
  'session:exit': (name: string, code: number | null) => void;
}

/**
 * Session manager with EventEmitter for proactive process monitoring
 */
class SessionManager extends EventEmitter {
  private runningProcesses = new Map<string, ChildProcess>();

  startSession(options: StartSessionOptions): SessionState {
    const { name, dir, path, port, fullPath } = options;

    // Check if already running
    const existing = getSession(name);
    if (existing && this.isProcessRunning(existing.pid)) {
      throw new Error(`Session "${name}" is already running`);
    }

    // Start ttyd process
    const ttydProcess = spawn(
      'ttyd',
      ['-W', '-p', String(port), '-b', fullPath, 'tmux', 'new', '-A', '-s', name],
      {
        cwd: dir,
        detached: true,
        stdio: 'ignore'
      }
    );

    ttydProcess.unref();

    if (!ttydProcess.pid) {
      throw new Error(`Failed to start ttyd for session "${name}"`);
    }

    // Track the process
    this.runningProcesses.set(name, ttydProcess);

    // Proactive cleanup: listen for process exit
    ttydProcess.on('exit', (code) => {
      this.handleProcessExit(name, code);
    });

    // Save to state
    const session: SessionState = {
      name,
      pid: ttydProcess.pid,
      port,
      path,
      dir,
      started_at: new Date().toISOString()
    };

    addSession(session);
    this.emit('session:start', session);

    return session;
  }

  stopSession(name: string): void {
    const session = getSession(name);
    if (!session) {
      throw new Error(`Session "${name}" not found`);
    }

    // Try to kill the process
    try {
      process.kill(session.pid, 'SIGTERM');
    } catch {
      // Process might already be dead
    }

    // Clean up
    this.cleanup(name);
    this.emit('session:stop', name);
  }

  isProcessRunning(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  listSessions(): SessionState[] {
    const sessions = getAllSessions();

    // Filter out dead sessions (lazy cleanup for sessions started before daemon)
    const activeSessions: SessionState[] = [];
    for (const session of sessions) {
      if (this.isProcessRunning(session.pid)) {
        activeSessions.push(session);
      } else {
        this.cleanup(session.name);
      }
    }

    return activeSessions;
  }

  stopAllSessions(): void {
    const sessions = this.listSessions();
    for (const session of sessions) {
      try {
        this.stopSession(session.name);
      } catch {
        // Ignore errors when stopping
      }
    }
  }

  private handleProcessExit(name: string, code: number | null): void {
    this.cleanup(name);
    this.emit('session:exit', name, code);
  }

  private cleanup(name: string): void {
    this.runningProcesses.delete(name);
    removeSession(name);
  }
}

// Singleton instance
const sessionManager = new SessionManager();

// Export singleton methods for backward compatibility
export function startSession(options: StartSessionOptions): SessionState {
  return sessionManager.startSession(options);
}

export function stopSession(name: string): void {
  sessionManager.stopSession(name);
}

export function isProcessRunning(pid: number): boolean {
  return sessionManager.isProcessRunning(pid);
}

export function listSessions(): SessionState[] {
  return sessionManager.listSessions();
}

export function stopAllSessions(): void {
  sessionManager.stopAllSessions();
}

export function allocatePort(config: Config): number {
  return getNextPort(config.base_port);
}

export function sessionNameFromDir(dir: string): string {
  const parts = dir.split('/');
  return parts[parts.length - 1] || 'default';
}

// Export the manager instance for direct event access
export { sessionManager };
