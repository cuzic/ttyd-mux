import { z } from 'zod';

// === 設定ファイル (config.yaml) ===

export const TmuxModeSchema = z.enum(['auto', 'attach', 'new']);
export type TmuxMode = z.infer<typeof TmuxModeSchema>;

export const SessionDefinitionSchema = z.object({
  name: z.string().min(1),
  dir: z.string().min(1),
  path: z.string().startsWith('/'),
  port_offset: z.number().int().min(0)
});

export type SessionDefinition = z.infer<typeof SessionDefinitionSchema>;

export const ToolbarConfigSchema = z.object({
  font_size_default_mobile: z.number().int().min(8).max(72).default(32),
  font_size_default_pc: z.number().int().min(8).max(72).default(14),
  font_size_min: z.number().int().min(6).max(20).default(10),
  font_size_max: z.number().int().min(24).max(96).default(48),
  double_tap_delay: z.number().int().min(100).max(1000).default(300)
});

export type ToolbarConfig = z.infer<typeof ToolbarConfigSchema>;

/** Default toolbar configuration */
export const DEFAULT_TOOLBAR_CONFIG: ToolbarConfig = {
  font_size_default_mobile: 32,
  font_size_default_pc: 14,
  font_size_min: 10,
  font_size_max: 48,
  double_tap_delay: 300
};

export const ConfigSchema = z.object({
  base_path: z.string().startsWith('/').default('/ttyd-mux'),
  base_port: z.number().int().min(1024).max(65535).default(7600),
  daemon_port: z.number().int().min(1024).max(65535).default(7680),
  listen_addresses: z.array(z.string()).default(['127.0.0.1', '::1']),
  listen_sockets: z.array(z.string()).default([]),
  auto_attach: z.boolean().default(true),
  sessions: z.array(SessionDefinitionSchema).default([]),
  proxy_mode: z.enum(['proxy', 'static']).default('proxy'),
  hostname: z.string().optional(),
  caddy_admin_api: z.string().default('http://localhost:2019'),
  tmux_mode: TmuxModeSchema.default('auto'),
  toolbar: ToolbarConfigSchema.default(DEFAULT_TOOLBAR_CONFIG)
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
