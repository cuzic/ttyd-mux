// Re-export all from daemon-client

export type { TmuxSessionResponse, TmuxSessionsResponse } from '@/core/config/types.js';

// Re-export all from api-client
export {
  apiRequest,
  getSessions,
  getStatus,
  getTmuxSessions,
  requestShutdown,
  startSession,
  stopSession
} from './api-client.js';
export {
  type DaemonClientDeps,
  defaultDaemonClientDeps,
  ensureDaemon,
  isDaemonRunning,
  resetDaemonClientDeps,
  restartDaemon,
  setDaemonClientDeps,
  shutdownDaemon
} from './daemon-client.js';
