// Types
export {
  TmuxModeSchema,
  type TmuxMode,
  SessionDefinitionSchema,
  type SessionDefinition,
  ConfigSchema,
  type Config,
  type DaemonState,
  type SessionState,
  type State,
  type ResolvedSession,
  type StartSessionRequest,
  type SessionResponse,
  type StatusResponse,
  type ErrorResponse
} from './types.js';

// Config
export {
  findConfigPath,
  loadConfig,
  getSessionPort,
  normalizeBasePath,
  getFullPath,
  findSessionDefinition
} from './config.js';

// State
export {
  getStateDir,
  getSocketPath,
  loadState,
  saveState,
  withStateLock,
  setDaemonState,
  clearDaemonState,
  getDaemonState,
  addSession,
  removeSession,
  getSession,
  getSessionByDir,
  getAllSessions,
  getNextPort,
  getNextPath
} from './state.js';
