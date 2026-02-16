import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { lockSync, unlockSync } from 'proper-lockfile';
import type { DaemonState, SessionState, State } from './types.js';

const STATE_DIR = join(homedir(), '.local', 'state', 'ttyd-mux');
const STATE_FILE = join(STATE_DIR, 'state.json');
const SOCKET_PATH = join(STATE_DIR, 'ttyd-mux.sock');

export function getStateDir(): string {
  return STATE_DIR;
}

export function getSocketPath(): string {
  return SOCKET_PATH;
}

function ensureStateDir(): void {
  if (!existsSync(STATE_DIR)) {
    mkdirSync(STATE_DIR, { recursive: true });
  }
}

function ensureStateFile(): void {
  ensureStateDir();
  if (!existsSync(STATE_FILE)) {
    writeFileSync(STATE_FILE, JSON.stringify(getDefaultState(), null, 2));
  }
}

function getDefaultState(): State {
  return {
    daemon: null,
    sessions: []
  };
}

export function loadState(): State {
  if (!existsSync(STATE_FILE)) {
    return getDefaultState();
  }

  try {
    const content = readFileSync(STATE_FILE, 'utf-8');
    return JSON.parse(content) as State;
  } catch {
    return getDefaultState();
  }
}

export function saveState(state: State): void {
  ensureStateDir();
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Execute a function with exclusive file lock on state.json
 */
export function withStateLock<T>(fn: () => T): T {
  ensureStateFile();
  lockSync(STATE_FILE, { retries: 5 });
  try {
    return fn();
  } finally {
    unlockSync(STATE_FILE);
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
