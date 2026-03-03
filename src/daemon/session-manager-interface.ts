/**
 * ISessionManager - Common interface for session management
 *
 * Abstracts the differences between ttyd and native terminal backends,
 * allowing router and API handlers to work with either backend.
 */

import type { SessionState } from '@/config/types.js';

/**
 * Minimal session information needed by router and API handlers
 */
export interface SessionInfo {
  /** Session name (unique identifier) */
  name: string;
  /** Working directory */
  dir: string;
  /** URL path (e.g., /my-session) */
  path: string;
  /** Process ID (ttyd or PTY) */
  pid: number;
  /** Session start time (ISO 8601) */
  startedAt: string;
  /** Port number (ttyd only, undefined for native) */
  port?: number;
}

/**
 * Options for creating a new session
 */
export interface CreateSessionOptions {
  /** Session name */
  name: string;
  /** Working directory */
  dir: string;
  /** URL path (without base path) */
  path: string;
  /** Full URL path (with base path, ttyd only) */
  fullPath?: string;
  /** Port number (ttyd only) */
  port?: number;
  /** Initial terminal columns (native only) */
  cols?: number;
  /** Initial terminal rows (native only) */
  rows?: number;
}

/**
 * Common session manager interface
 *
 * Both TtydSessionManager and NativeSessionManager should implement
 * this interface (or provide an adapter that does).
 */
export interface ISessionManager {
  /**
   * List all active sessions
   */
  listSessions(): SessionInfo[];

  /**
   * Get a session by name
   * @returns Session info or undefined if not found
   */
  getSession(name: string): SessionInfo | undefined;

  /**
   * Check if a session exists
   */
  hasSession(name: string): boolean;

  /**
   * Create and start a new session
   * @throws Error if session already exists or creation fails
   */
  createSession(options: CreateSessionOptions): Promise<SessionInfo>;

  /**
   * Stop a session
   * @throws Error if session not found
   */
  stopSession(name: string): Promise<void>;

  /**
   * Stop all sessions
   */
  stopAll(): Promise<void>;
}

/**
 * Convert SessionState (ttyd format) to SessionInfo
 */
export function sessionStateToInfo(state: SessionState): SessionInfo {
  return {
    name: state.name,
    dir: state.dir,
    path: state.path,
    pid: state.pid,
    startedAt: state.started_at,
    port: state.port
  };
}
