import type {
  Config,
  SessionResponse,
  StartSessionRequest,
  StatusResponse
} from '@/core/config/types.js';
import { buildApiUrl } from './daemon-url.js';

/**
 * Make an API request to the daemon
 */
export async function apiRequest<T>(
  config: Config,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const url = buildApiUrl(config, path);

  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error((data as { error?: string }).error ?? 'Request failed');
  }

  return data as T;
}

/**
 * Get daemon status
 */
export function getStatus(config: Config): Promise<StatusResponse> {
  return apiRequest<StatusResponse>(config, 'GET', '/api/status');
}

/**
 * Get all sessions
 */
export function getSessions(config: Config): Promise<SessionResponse[]> {
  return apiRequest<SessionResponse[]>(config, 'GET', '/api/sessions');
}

/**
 * Start a new session
 */
export function startSession(
  config: Config,
  request: StartSessionRequest
): Promise<SessionResponse> {
  return apiRequest<SessionResponse>(config, 'POST', '/api/sessions', request);
}

export interface StopSessionOptions {
  killTmux?: boolean;
}

/**
 * Stop a session
 */
export async function stopSession(
  config: Config,
  name: string,
  options?: StopSessionOptions
): Promise<void> {
  const query = options?.killTmux ? '?killTmux=true' : '';
  await apiRequest<{ success: boolean }>(
    config,
    'DELETE',
    `/api/sessions/${encodeURIComponent(name)}${query}`
  );
}

export interface ShutdownOptions {
  stopSessions?: boolean;
  killTmux?: boolean;
}

/**
 * Request daemon shutdown
 */
export async function requestShutdown(config: Config, options?: ShutdownOptions): Promise<void> {
  try {
    await apiRequest<{ success: boolean }>(config, 'POST', '/api/shutdown', options);
  } catch {
    // Server will shut down, so connection may be lost
  }
}

export interface TmuxSessionResponse {
  name: string;
  windows: number;
  created: string;
  attached: boolean;
  cwd?: string;
}

export interface TmuxSessionsResponse {
  sessions: TmuxSessionResponse[];
  installed: boolean;
}

/**
 * Get tmux sessions
 */
export function getTmuxSessions(config: Config): Promise<TmuxSessionsResponse> {
  return apiRequest<TmuxSessionsResponse>(config, 'GET', '/api/tmux/sessions');
}
