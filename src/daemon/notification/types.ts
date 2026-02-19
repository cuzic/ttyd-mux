/**
 * Notification system types
 */

/**
 * Pattern configuration for notification triggers
 */
export interface PatternConfig {
  /** Regular expression pattern to match */
  regex: string;
  /** Message to include in notification */
  message: string;
  /** Cooldown in seconds (optional, uses default if not set) */
  cooldown?: number;
}

/**
 * Push subscription from browser
 */
export interface PushSubscription {
  /** Unique subscription ID */
  id: string;
  /** Browser push endpoint URL */
  endpoint: string;
  /** Subscription keys */
  keys: {
    p256dh: string;
    auth: string;
  };
  /** Session name this subscription is for (optional, null = all sessions) */
  sessionName?: string;
  /** Created timestamp */
  createdAt: string;
}

/**
 * VAPID keys for Web Push
 */
export interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

/**
 * Notification configuration in config.yaml
 */
export interface NotificationConfig {
  /** Enable/disable notifications */
  enabled?: boolean;
  /** VAPID contact email */
  contact_email?: string;
  /** Patterns to match */
  patterns?: PatternConfig[];
  /** Default cooldown in seconds */
  default_cooldown?: number;
}

/**
 * Match result when a pattern matches
 */
export interface MatchResult {
  /** The matched pattern configuration */
  pattern: PatternConfig;
  /** The text that matched */
  matchedText: string;
  /** Session name where match occurred */
  sessionName: string;
  /** Timestamp of match */
  timestamp: string;
}
