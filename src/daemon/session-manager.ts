import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { type StateStore, defaultStateStore } from '@/config/state-store.js';
import type { Config, SessionState, TmuxMode } from '@/config/types.js';
import { createLogger } from '@/utils/logger.js';
import { type ProcessRunner, defaultProcessRunner } from '@/utils/process-runner.js';
import { type TmuxClient, defaultTmuxClient } from '@/utils/tmux-client.js';

const log = createLogger('session');

export interface StartSessionOptions {
  name: string;
  dir: string;
  path: string;
  port: number;
  fullPath: string;
  tmuxMode?: TmuxMode;
}

/**
 * Get tmux command arguments based on mode
 */
function getTmuxCommand(name: string, mode: TmuxMode): string[] {
  switch (mode) {
    case 'attach':
      return ['tmux', 'attach-session', '-t', name];
    case 'new':
      return ['tmux', 'new-session', '-s', name];
    default:
      // For auto mode, session is pre-created by ensureSession
      // Just attach to it
      return ['tmux', 'attach-session', '-t', name];
  }
}

export interface SessionEvents {
  'session:start': (session: SessionState) => void;
  'session:stop': (name: string) => void;
  'session:exit': (name: string, code: number | null) => void;
}

/**
 * Dependencies for SessionManager (for testing)
 */
export interface SessionManagerDeps {
  stateStore: StateStore;
  processRunner: ProcessRunner;
  tmuxClient: TmuxClient;
}

/**
 * Default dependencies using real implementations
 */
export const defaultSessionManagerDeps: SessionManagerDeps = {
  stateStore: defaultStateStore,
  processRunner: defaultProcessRunner,
  tmuxClient: defaultTmuxClient
};

/**
 * Session manager with EventEmitter for proactive process monitoring
 */
export class SessionManager extends EventEmitter {
  private runningProcesses = new Map<string, ChildProcess>();
  private deps: SessionManagerDeps;

  constructor(deps: SessionManagerDeps = defaultSessionManagerDeps) {
    super();
    this.deps = deps;
  }

  startSession(options: StartSessionOptions): SessionState {
    const { name, dir, path, port, fullPath, tmuxMode = 'auto' } = options;
    const { stateStore, processRunner, tmuxClient } = this.deps;

    log.info(`Starting session: ${name} (port=${port}, mode=${tmuxMode})`);

    // Check if already running
    const existing = stateStore.getSession(name);
    if (existing && processRunner.isProcessRunning(existing.pid)) {
      log.warn(`Session "${name}" is already running (pid=${existing.pid})`);
      throw new Error(`Session "${name}" is already running`);
    }

    // For auto mode, ensure tmux session exists before starting ttyd
    if (tmuxMode === 'auto') {
      log.debug(`Ensuring tmux session exists: ${name}`);
      tmuxClient.ensureSession(name, dir);
    }

    // Get tmux command based on mode
    const tmuxCmd = getTmuxCommand(name, tmuxMode);
    const ttydArgs = ['-W', '-p', String(port), '-b', fullPath, ...tmuxCmd];
    log.debug(`ttyd command: ttyd ${ttydArgs.join(' ')}`);

    // Start ttyd process
    const ttydProcess = processRunner.spawn('ttyd', ttydArgs, {
      cwd: dir,
      detached: true,
      stdio: 'ignore'
    });

    ttydProcess.unref();

    if (!ttydProcess.pid) {
      log.error(`Failed to start ttyd for session "${name}"`);
      throw new Error(`Failed to start ttyd for session "${name}"`);
    }

    log.info(`ttyd started: pid=${ttydProcess.pid}`);

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

    stateStore.addSession(session);
    this.emit('session:start', session);

    return session;
  }

  stopSession(name: string): void {
    const { stateStore, processRunner } = this.deps;

    log.info(`Stopping session: ${name}`);
    const session = stateStore.getSession(name);
    if (!session) {
      log.warn(`Session "${name}" not found`);
      throw new Error(`Session "${name}" not found`);
    }

    // Try to kill the process
    try {
      processRunner.kill(session.pid, 'SIGTERM');
      log.info(`Sent SIGTERM to pid ${session.pid}`);
    } catch (err) {
      log.debug(`Process ${session.pid} might already be dead: ${err}`);
    }

    // Clean up
    this.cleanup(name);
    this.emit('session:stop', name);
  }

  isProcessRunning(pid: number): boolean {
    return this.deps.processRunner.isProcessRunning(pid);
  }

  listSessions(): SessionState[] {
    const { stateStore, processRunner } = this.deps;
    const sessions = stateStore.getAllSessions();

    // Filter out dead sessions (lazy cleanup for sessions started before daemon)
    const activeSessions: SessionState[] = [];
    for (const session of sessions) {
      if (processRunner.isProcessRunning(session.pid)) {
        activeSessions.push(session);
      } else {
        this.cleanup(session.name);
      }
    }

    return activeSessions;
  }

  stopAllSessions(): void {
    log.info('Stopping all sessions');
    const sessions = this.listSessions();
    for (const session of sessions) {
      try {
        this.stopSession(session.name);
      } catch (err) {
        log.warn(`Error stopping session "${session.name}": ${err}`);
      }
    }
    log.info(`Stopped ${sessions.length} sessions`);
  }

  private handleProcessExit(name: string, code: number | null): void {
    log.info(`Session "${name}" exited with code ${code}`);
    this.cleanup(name);
    this.emit('session:exit', name, code);
  }

  private cleanup(name: string): void {
    log.debug(`Cleaning up session: ${name}`);
    this.runningProcesses.delete(name);
    this.deps.stateStore.removeSession(name);
  }
}

/**
 * Shared session manager instance
 */
export const sessionManager = new SessionManager();

/**
 * Allocate next available port for a new session
 */
export function allocatePort(config: Config): number {
  return defaultStateStore.getNextPort(config.base_port);
}

/**
 * Extract session name from directory path
 */
export function sessionNameFromDir(dir: string): string {
  const parts = dir.split('/');
  return parts[parts.length - 1] || 'default';
}

/**
 * Create a SessionManager with custom dependencies (for testing)
 */
export function createSessionManager(deps: Partial<SessionManagerDeps> = {}): SessionManager {
  return new SessionManager({
    ...defaultSessionManagerDeps,
    ...deps
  });
}
