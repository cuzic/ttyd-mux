import { z } from 'zod';

// === 設定ファイル (config.yaml) ===

export const SessionDefinitionSchema = z.object({
  name: z.string().min(1),
  dir: z.string().min(1),
  path: z.string().startsWith('/'),
  port_offset: z.number().int().min(0)
});

export type SessionDefinition = z.infer<typeof SessionDefinitionSchema>;

export const ConfigSchema = z.object({
  base_path: z.string().startsWith('/').default('/ttyd-mux'),
  base_port: z.number().int().min(1024).max(65535).default(7600),
  daemon_port: z.number().int().min(1024).max(65535).default(7680),
  listen_addresses: z.array(z.string()).default(['127.0.0.1', '::1']),
  auto_attach: z.boolean().default(true),
  sessions: z.array(SessionDefinitionSchema).default([])
});

export type Config = z.infer<typeof ConfigSchema>;

// === 状態ファイル (state.json) ===

export interface DaemonState {
  pid: number;
  port: number;
  started_at: string;
}

export interface SessionState {
  name: string;
  pid: number;
  port: number;
  path: string;
  dir: string;
  started_at: string;
}

export interface State {
  daemon: DaemonState | null;
  sessions: SessionState[];
}

// === 解決済みセッション（設定 + 状態を統合）===

export interface ResolvedSession {
  name: string;
  dir: string;
  path: string;
  fullPath: string; // base_path + path
  port: number;
  running: boolean;
  pid?: number;
}

// === API リクエスト/レスポンス ===

export interface StartSessionRequest {
  name: string;
  dir: string;
  path?: string; // 省略時は name から生成
}

export interface SessionResponse {
  name: string;
  port: number;
  path: string;
  fullPath: string;
  dir: string;
  pid: number;
  started_at: string;
}

export interface StatusResponse {
  daemon: DaemonState;
  sessions: SessionResponse[];
}

export interface ErrorResponse {
  error: string;
}
