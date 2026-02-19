/**
 * StateStore interface for abstracting state management
 * Allows in-memory state store for testing without file system access
 */

import type { DaemonState, SessionState, ShareState, State } from './types.js';

// Re-export defaultStateStore from state.ts for convenience
export { defaultStateStore } from './state.js';

export interface StateStore {
  // Path accessors
  getStateDir(): string;
  getSocketPath(): string;

  // Raw state access
  loadState(): State;
  saveState(state: State): void;

  // Daemon state
  getDaemonState(): DaemonState | null;
  setDaemonState(daemon: DaemonState): void;
  clearDaemonState(): void;

  // Session state
  addSession(session: SessionState): void;
  removeSession(name: string): void;
  getSession(name: string): SessionState | undefined;
  getSessionByDir(dir: string): SessionState | undefined;
  getAllSessions(): SessionState[];

  // Utilities
  getNextPort(basePort: number): number;
  getNextPath(basePath: string, name: string): string;

  // Share state
  addShare(share: ShareState): void;
  removeShare(token: string): void;
  getShare(token: string): ShareState | undefined;
  getAllShares(): ShareState[];
}

/**
 * Create an in-memory StateStore for testing
 */
export function createInMemoryStateStore(initialState?: Partial<State>): StateStore {
  let state: State = {
    daemon: initialState?.daemon ?? null,
    sessions: initialState?.sessions ?? [],
    shares: initialState?.shares ?? []
  };

  return {
    getStateDir: () => '/tmp/test-state',
    getSocketPath: () => '/tmp/test-state/ttyd-mux.sock',

    loadState: () => ({ ...state, sessions: [...state.sessions] }),
    saveState: (newState: State) => {
      state = { ...newState, sessions: [...newState.sessions] };
    },

    getDaemonState: () => state.daemon,
    setDaemonState: (daemon: DaemonState) => {
      state.daemon = daemon;
    },
    clearDaemonState: () => {
      state.daemon = null;
    },

    addSession: (session: SessionState) => {
      state.sessions = state.sessions.filter((s) => s.name !== session.name);
      state.sessions.push(session);
    },
    removeSession: (name: string) => {
      state.sessions = state.sessions.filter((s) => s.name !== name);
    },
    getSession: (name: string) => state.sessions.find((s) => s.name === name),
    getSessionByDir: (dir: string) => state.sessions.find((s) => s.dir === dir),
    getAllSessions: () => [...state.sessions],

    getNextPort: (basePort: number) => {
      if (state.sessions.length === 0) {
        return basePort + 1;
      }
      const usedPorts = state.sessions.map((s) => s.port);
      let port = basePort + 1;
      while (usedPorts.includes(port)) {
        port++;
      }
      return port;
    },

    getNextPath: (basePath: string, name: string) => {
      return `${basePath}/${name}`.replace(/\/+/g, '/');
    },

    addShare: (share: ShareState) => {
      if (!state.shares) state.shares = [];
      state.shares = state.shares.filter((s) => s.token !== share.token);
      state.shares.push(share);
    },
    removeShare: (token: string) => {
      if (state.shares) {
        state.shares = state.shares.filter((s) => s.token !== token);
      }
    },
    getShare: (token: string) => state.shares?.find((s) => s.token === token),
    getAllShares: () => [...(state.shares ?? [])]
  };
}
