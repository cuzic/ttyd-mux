// Config Types (from config.yaml)
export {
  TmuxModeSchema,
  type TmuxMode,
  SessionDefinitionSchema,
  type SessionDefinition,
  ConfigSchema,
  type Config
} from './types.js';

// State Types (from state.json)
export {
  type DaemonState,
  type SessionState,
  type ShareState,
  type PushSubscriptionState,
  type State
} from './types.js';

// API Types (for client-server communication)
export {
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
  normalizeBasePath,
  getFullPath,
  findSessionDefinition
} from './config.js';

// State - Path utilities
export { getConfigDir, getStateDir, getSocketPath } from './state.js';

// State - Low-level operations
export { loadState, saveState, withStateLock } from './state.js';

// State - Daemon operations
export { getDaemonState, setDaemonState, clearDaemonState } from './state.js';

// State - Session operations
export {
  addSession,
  removeSession,
  getSession,
  getSessionByDir,
  getAllSessions,
  getNextPath
} from './state.js';

// State - Share operations
export { addShare, removeShare, getShare, getAllShares } from './state.js';

// State - Push subscription operations
export {
  addPushSubscription,
  removePushSubscription,
  getPushSubscription,
  getAllPushSubscriptions
} from './state.js';
