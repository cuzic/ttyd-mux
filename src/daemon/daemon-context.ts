/**
 * DaemonContext - Centralized state management for the daemon
 *
 * Provides a single point of access for:
 * - Session management (ttyd or native)
 * - Static file servers
 * - Configuration
 *
 * This enables better dependency injection and testing by avoiding
 * scattered global singletons.
 */

import type { Config } from '@/config/types.js';
import type { ISessionManager, SessionInfo, CreateSessionOptions } from './session-manager-interface.js';
import { sessionManager as ttydSessionManager, type SessionManager } from './session-manager.js';
import { staticFiles, resetAllStaticCaches } from './static-file-server.js';
import { sessionStateToInfo } from './session-manager-interface.js';

/**
 * Daemon context interface
 *
 * Defines the contract for accessing daemon-wide state.
 * Both production and test code can implement this interface.
 */
export interface IDaemonContext {
  /** Configuration */
  readonly config: Config;

  /** Session manager (backend-agnostic) */
  readonly sessions: ISessionManager;

  /** Static file servers */
  readonly staticFiles: typeof staticFiles;

  /** Reset all caches (for testing) */
  resetCaches(): void;
}

/**
 * Adapter to make ttyd SessionManager implement ISessionManager
 */
class TtydSessionManagerAdapter implements ISessionManager {
  constructor(private readonly manager: SessionManager) {}

  listSessions(): SessionInfo[] {
    return this.manager.listSessions().map(sessionStateToInfo);
  }

  getSession(name: string): SessionInfo | undefined {
    const session = this.manager.findByName(name);
    return session ? sessionStateToInfo(session) : undefined;
  }

  hasSession(name: string): boolean {
    return this.manager.findByName(name) !== undefined;
  }

  async createSession(options: CreateSessionOptions): Promise<SessionInfo> {
    if (!options.fullPath || !options.port) {
      throw new Error('fullPath and port are required for ttyd backend');
    }
    const session = await this.manager.startSession({
      name: options.name,
      dir: options.dir,
      path: options.path,
      fullPath: options.fullPath,
      port: options.port
    });
    return sessionStateToInfo(session);
  }

  async stopSession(name: string): Promise<void> {
    this.manager.stopSession(name);
  }

  async stopAll(): Promise<void> {
    this.manager.stopAllSessions();
  }
}

/**
 * Default daemon context using production singletons
 */
export class DaemonContext implements IDaemonContext {
  readonly config: Config;
  readonly sessions: ISessionManager;
  readonly staticFiles = staticFiles;

  constructor(config: Config, sessionManager?: ISessionManager) {
    this.config = config;
    this.sessions = sessionManager ?? new TtydSessionManagerAdapter(ttydSessionManager);
  }

  resetCaches(): void {
    resetAllStaticCaches();
  }
}

/**
 * Create a daemon context
 *
 * @param config - Daemon configuration
 * @param options - Optional overrides for testing
 */
export function createDaemonContext(
  config: Config,
  options?: {
    sessionManager?: ISessionManager;
  }
): IDaemonContext {
  return new DaemonContext(config, options?.sessionManager);
}
