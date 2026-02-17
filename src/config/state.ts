import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { lockSync, unlockSync } from 'proper-lockfile';
import type { DaemonState, SessionState, State } from './types.js';

/**
 * Get state directory path.
 * Can be overridden via TTYD_MUX_STATE_DIR environment variable for testing.
 */
function getStateDirPath(): string {
  return process.env['TTYD_MUX_STATE_DIR'] ?? join(homedir(), '.local', 'state', 'ttyd-mux');
}

function getStateFilePath(): string {
  return join(getStateDirPath(), 'state.json');
}

function getSocketFilePath(): string {
  return join(getStateDirPath(), 'ttyd-mux.sock');
}

export function getStateDir(): string {
  return getStateDirPath();
}

export function getSocketPath(): string {
  return getSocketFilePath();
}

function ensureStateDir(): void {
  const stateDir = getStateDirPath();
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }
}

function ensureStateFile(): void {
  ensureStateDir();
  const stateFile = getStateFilePath();
  if (!existsSync(stateFile)) {
    writeFileSync(stateFile, JSON.stringify(getDefaultState(), null, 2));
  }
}

function getDefaultState(): State {
  return {
    daemon: null,
    sessions: []
  };
}

export function loadState(): State {
  const stateFile = getStateFilePath();
  if (!existsSync(stateFile)) {
    return getDefaultState();
  }

  try {
    const content = readFileSync(stateFile, 'utf-8');
    return JSON.parse(content) as State;
  } catch {
    return getDefaultState();
  }
}

export function saveState(state: State): void {
  ensureStateDir();
  const stateFile = getStateFilePath();
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

/**
 * Execute a function with exclusive file lock on state.json
 */
export function withStateLock<T>(fn: () => T): T {
  ensureStateFile();
  const stateFile = getStateFilePath();
  lockSync(stateFile);
  try {
    return fn();
  } finally {
    unlockSync(stateFile);
  }
}

// === Daemon State ===

export function setDaemonState(daemon: DaemonState): void {
  withStateLock(() => {
    const state = loadState();
    state.daemon = daemon;
    saveState(state);
  });
}

export function clearDaemonState(): void {
  withStateLock(() => {
    const state = loadState();
    state.daemon = null;
    saveState(state);
  });
}

export function getDaemonState(): DaemonState | null {
  return loadState().daemon;
}

// === Session State ===

export function addSession(session: SessionState): void {
  withStateLock(() => {
    const state = loadState();
    // Remove existing session with same name
    state.sessions = state.sessions.filter((s) => s.name !== session.name);
    state.sessions.push(session);
    saveState(state);
  });
}

export function removeSession(name: string): void {
  withStateLock(() => {
    const state = loadState();
    state.sessions = state.sessions.filter((s) => s.name !== name);
    saveState(state);
  });
}

export function getSession(name: string): SessionState | undefined {
  return loadState().sessions.find((s) => s.name === name);
}

export function getSessionByDir(dir: string): SessionState | undefined {
  return loadState().sessions.find((s) => s.dir === dir);
}

export function getAllSessions(): SessionState[] {
  return loadState().sessions;
}

export function getNextPort(basePort: number): number {
  const sessions = getAllSessions();
  if (sessions.length === 0) {
    return basePort + 1;
  }

  const usedPorts = sessions.map((s) => s.port);
  let port = basePort + 1;
  while (usedPorts.includes(port)) {
    port++;
  }
  return port;
}

export function getNextPath(basePath: string, name: string): string {
  return `${basePath}/${name}`.replace(/\/+/g, '/');
}
