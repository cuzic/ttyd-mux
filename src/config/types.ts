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

export const FileTransferConfigSchema = z.object({
  enabled: z.boolean().default(true),
  max_file_size: z
    .number()
    .int()
    .min(1024)
    .default(100 * 1024 * 1024), // 100MB
  allowed_extensions: z.array(z.string()).default([])
});

export type FileTransferConfig = z.infer<typeof FileTransferConfigSchema>;

/** Default file transfer configuration */
export const DEFAULT_FILE_TRANSFER_CONFIG: FileTransferConfig = {
  enabled: true,
  max_file_size: 100 * 1024 * 1024, // 100MB
  allowed_extensions: []
};

export const NotificationPatternSchema = z.object({
  regex: z.string().min(1),
  message: z.string().min(1),
  cooldown: z.number().int().min(0).optional()
});

export type NotificationPatternConfig = z.infer<typeof NotificationPatternSchema>;

export const NotificationConfigSchema = z.object({
  enabled: z.boolean().default(true),
  contact_email: z.string().email().optional(),
  bell_notification: z.boolean().default(true),
  bell_cooldown: z.number().int().min(0).default(10),
  patterns: z.array(NotificationPatternSchema).default([]),
  default_cooldown: z.number().int().min(0).default(300)
});

export type NotificationConfig = z.infer<typeof NotificationConfigSchema>;

/** Default notification configuration */
export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  enabled: true,
  bell_notification: true,
  bell_cooldown: 10,
  patterns: [],
  default_cooldown: 300
};

export const TabsOrientationSchema = z.enum(['horizontal', 'vertical']);
export type TabsOrientation = z.infer<typeof TabsOrientationSchema>;

export const TabsPositionSchema = z.enum(['left', 'right', 'top', 'bottom']);
export type TabsPosition = z.infer<typeof TabsPositionSchema>;

export const TabsConfigSchema = z.object({
  enabled: z.boolean().default(true),
  orientation: TabsOrientationSchema.default('vertical'),
  position: TabsPositionSchema.default('left'),
  tab_width: z.number().int().min(100).max(400).default(200),
  tab_height: z.number().int().min(30).max(100).default(40),
  auto_refresh_interval: z.number().int().min(1000).max(60000).default(5000),
  preload_iframes: z.boolean().default(false),
  show_session_info: z.boolean().default(true)
});

export type TabsConfig = z.infer<typeof TabsConfigSchema>;

/** Default tabs configuration */
export const DEFAULT_TABS_CONFIG: TabsConfig = {
  enabled: true,
  orientation: 'vertical',
  position: 'left',
  tab_width: 200,
  tab_height: 40,
  auto_refresh_interval: 5000,
  preload_iframes: false,
  show_session_info: true
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
  toolbar: ToolbarConfigSchema.default(DEFAULT_TOOLBAR_CONFIG),
  notifications: NotificationConfigSchema.default(DEFAULT_NOTIFICATION_CONFIG),
  file_transfer: FileTransferConfigSchema.default(DEFAULT_FILE_TRANSFER_CONFIG),
  tabs: TabsConfigSchema.default(DEFAULT_TABS_CONFIG)
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

export interface ShareState {
  token: string;
  sessionName: string;
  createdAt: string;
  expiresAt: string;
  password?: string;
}

export interface PushSubscriptionState {
  id: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  sessionName?: string;
  createdAt: string;
}

export interface State {
  daemon: DaemonState | null;
  sessions: SessionState[];
  shares?: ShareState[];
  pushSubscriptions?: PushSubscriptionState[];
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
