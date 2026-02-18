/**
 * Daemon Configuration Manager
 *
 * Manages the daemon's configuration with support for hot-reload.
 */

import type { Config } from '@/config/types.js';
import { loadConfig } from '@/config/config.js';
import { createLogger } from '@/utils/logger.js';

const log = createLogger('config-manager');

export interface ReloadResult {
  success: boolean;
  reloaded: string[];
  requiresRestart: string[];
  error?: string;
}

/**
 * Compare two configs and identify what changed
 */
function detectChanges(
  oldConfig: Config,
  newConfig: Config
): { hotReloadable: string[]; requiresRestart: string[] } {
  const hotReloadable: string[] = [];
  const requiresRestart: string[] = [];

  // Check toolbar config
  const toolbarKeys = [
    'font_size_default_mobile',
    'font_size_default_pc',
    'font_size_min',
    'font_size_max',
    'double_tap_delay'
  ] as const;

  for (const key of toolbarKeys) {
    if (oldConfig.toolbar[key] !== newConfig.toolbar[key]) {
      hotReloadable.push(`toolbar.${key}`);
    }
  }

  // Check session definitions
  const oldSessionNames = new Set(oldConfig.sessions?.map((s) => s.name) ?? []);
  const newSessionNames = new Set(newConfig.sessions?.map((s) => s.name) ?? []);
  if (
    oldSessionNames.size !== newSessionNames.size ||
    ![...oldSessionNames].every((n) => newSessionNames.has(n))
  ) {
    hotReloadable.push('sessions');
  }

  // Check other hot-reloadable settings
  if (oldConfig.proxy_mode !== newConfig.proxy_mode) {
    hotReloadable.push('proxy_mode');
  }
  if (oldConfig.hostname !== newConfig.hostname) {
    hotReloadable.push('hostname');
  }
  if (oldConfig.caddy_admin_api !== newConfig.caddy_admin_api) {
    hotReloadable.push('caddy_admin_api');
  }
  if (oldConfig.tmux_mode !== newConfig.tmux_mode) {
    hotReloadable.push('tmux_mode');
  }
  if (oldConfig.auto_attach !== newConfig.auto_attach) {
    hotReloadable.push('auto_attach');
  }

  // Check settings that require restart
  if (oldConfig.daemon_port !== newConfig.daemon_port) {
    requiresRestart.push('daemon_port');
  }
  if (oldConfig.base_path !== newConfig.base_path) {
    requiresRestart.push('base_path');
  }
  if (oldConfig.base_port !== newConfig.base_port) {
    requiresRestart.push('base_port');
  }
  if (JSON.stringify(oldConfig.listen_addresses) !== JSON.stringify(newConfig.listen_addresses)) {
    requiresRestart.push('listen_addresses');
  }
  if (JSON.stringify(oldConfig.listen_sockets) !== JSON.stringify(newConfig.listen_sockets)) {
    requiresRestart.push('listen_sockets');
  }

  return { hotReloadable, requiresRestart };
}

class ConfigManager {
  private config: Config;
  private configPath?: string;

  constructor(configPath?: string) {
    this.configPath = configPath;
    this.config = loadConfig(configPath);
  }

  /**
   * Get the current configuration
   */
  getConfig(): Config {
    return this.config;
  }

  /**
   * Reload configuration from disk
   */
  reload(): ReloadResult {
    try {
      const newConfig = loadConfig(this.configPath);
      const { hotReloadable, requiresRestart } = detectChanges(this.config, newConfig);

      if (hotReloadable.length === 0 && requiresRestart.length === 0) {
        log.info('Config reload: no changes detected');
        return {
          success: true,
          reloaded: [],
          requiresRestart: []
        };
      }

      // Apply the new config
      this.config = newConfig;

      log.info(`Config reloaded: ${hotReloadable.length} settings updated`);
      if (hotReloadable.length > 0) {
        log.info(`  Hot-reloaded: ${hotReloadable.join(', ')}`);
      }
      if (requiresRestart.length > 0) {
        log.warn(`  Requires restart: ${requiresRestart.join(', ')}`);
      }

      return {
        success: true,
        reloaded: hotReloadable,
        requiresRestart
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Config reload failed: ${message}`);
      return {
        success: false,
        reloaded: [],
        requiresRestart: [],
        error: message
      };
    }
  }
}

// Singleton instance
let instance: ConfigManager | null = null;

/**
 * Initialize the config manager
 */
export function initConfigManager(configPath?: string): ConfigManager {
  instance = new ConfigManager(configPath);
  return instance;
}

/**
 * Get the config manager instance
 */
export function getConfigManager(): ConfigManager {
  if (!instance) {
    throw new Error('ConfigManager not initialized. Call initConfigManager first.');
  }
  return instance;
}

/**
 * Get the current config (convenience function)
 */
export function getCurrentConfig(): Config {
  return getConfigManager().getConfig();
}

/**
 * Reload the config (convenience function)
 */
export function reloadConfig(): ReloadResult {
  return getConfigManager().reload();
}
