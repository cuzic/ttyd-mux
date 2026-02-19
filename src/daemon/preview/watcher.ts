/**
 * File Watcher Service
 *
 * Watches files for changes using fs.watch and notifies subscribers.
 * Uses dependency injection for testability.
 */

import { normalize } from 'node:path';
import { createLogger } from '@/utils/logger.js';
import {
  type FileWatcherDeps,
  type WatchHandle,
  defaultFileWatcherDeps
} from './deps.js';
import type { FileChangeEvent, PreviewOptions } from './types.js';

const log = createLogger('preview-watcher');

/** Watched file info */
interface WatchedFile<TClient> {
  sessionDir: string;
  relativePath: string;
  fullPath: string;
  clients: Set<TClient>;
}

/** Default options */
const DEFAULT_OPTIONS: PreviewOptions = {
  debounceMs: 300,
  allowedExtensions: ['.html', '.htm']
};

/**
 * File Watcher Service
 *
 * Manages file watching with debounced change notifications.
 */
export class FileWatcherService<TClient = unknown> {
  private deps: FileWatcherDeps;
  private options: PreviewOptions;
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private watchers = new Map<string, WatchHandle>();
  private watchedFiles = new Map<string, WatchedFile<TClient>>();
  private changeListeners: Array<(event: FileChangeEvent) => void> = [];

  constructor(deps: FileWatcherDeps = defaultFileWatcherDeps, options: PreviewOptions = DEFAULT_OPTIONS) {
    this.deps = deps;
    this.options = options;
  }

  /**
   * Configure the watcher options
   */
  configure(newOptions: Partial<PreviewOptions>): void {
    this.options = { ...this.options, ...newOptions };
    log.debug('Watcher configured:', this.options);
  }

  /**
   * Get current options
   */
  getOptions(): PreviewOptions {
    return { ...this.options };
  }

  /**
   * Watch a file for changes
   */
  watchFile(
    sessionDir: string,
    relativePath: string,
    sessionName: string,
    client: TClient
  ): boolean {
    // Validate extension
    if (!this.isAllowedExtension(relativePath)) {
      log.warn(`Extension not allowed for preview: ${relativePath}`);
      return false;
    }

    // Resolve and validate path
    const fullPath = this.deps.pathResolver.resolveFilePath(sessionDir, relativePath);
    if (!fullPath) {
      log.warn(`Invalid path for watch: ${relativePath}`);
      return false;
    }

    // Check if file exists
    if (!this.deps.fs.existsSync(fullPath)) {
      log.warn(`File not found for watch: ${fullPath}`);
      return false;
    }

    const key = this.getFileKey(sessionDir, relativePath);

    // Check if already watching
    let watchedFile = this.watchedFiles.get(key);
    if (watchedFile) {
      // Add client to existing watch
      watchedFile.clients.add(client);
      log.debug(`Added client to existing watch: ${key}`);
      return true;
    }

    // Create new watcher
    try {
      const watcher = this.deps.fs.watch(fullPath, (eventType) => {
        if (eventType === 'change') {
          this.emitChange(sessionName, relativePath);
        }
      });

      watcher.on('error', (err) => {
        log.error(`Watcher error for ${fullPath}:`, err);
        this.unwatchFile(sessionDir, relativePath, client);
      });

      this.watchers.set(key, watcher);

      watchedFile = {
        sessionDir,
        relativePath,
        fullPath,
        clients: new Set([client])
      };
      this.watchedFiles.set(key, watchedFile);

      log.info(`Started watching: ${sessionName}/${relativePath}`);
      return true;
    } catch (err) {
      log.error(`Failed to watch file: ${fullPath}`, err);
      return false;
    }
  }

  /**
   * Stop watching a file for a client
   */
  unwatchFile(sessionDir: string, relativePath: string, client: TClient): void {
    const key = this.getFileKey(sessionDir, relativePath);
    const watchedFile = this.watchedFiles.get(key);

    if (!watchedFile) {
      return;
    }

    // Remove client
    watchedFile.clients.delete(client);

    // If no more clients, stop watching
    if (watchedFile.clients.size === 0) {
      const watcher = this.watchers.get(key);
      if (watcher) {
        watcher.close();
        this.watchers.delete(key);
      }
      this.watchedFiles.delete(key);
      log.info(`Stopped watching: ${key}`);
    }
  }

  /**
   * Remove all watches for a client
   */
  unwatchAllForClient(client: TClient): void {
    for (const [key, watchedFile] of this.watchedFiles.entries()) {
      if (watchedFile.clients.has(client)) {
        watchedFile.clients.delete(client);

        // If no more clients, stop watching
        if (watchedFile.clients.size === 0) {
          const watcher = this.watchers.get(key);
          if (watcher) {
            watcher.close();
            this.watchers.delete(key);
          }
          this.watchedFiles.delete(key);
          log.debug(`Stopped watching (client disconnected): ${key}`);
        }
      }
    }
  }

  /**
   * Register a file change listener
   */
  onFileChange(callback: (event: FileChangeEvent) => void): () => void {
    this.changeListeners.push(callback);
    return () => {
      const index = this.changeListeners.indexOf(callback);
      if (index !== -1) {
        this.changeListeners.splice(index, 1);
      }
    };
  }

  /**
   * Get watcher statistics
   */
  getStats(): { watchedFiles: number; activeClients: number } {
    let activeClients = 0;
    for (const file of this.watchedFiles.values()) {
      activeClients += file.clients.size;
    }
    return {
      watchedFiles: this.watchedFiles.size,
      activeClients
    };
  }

  /**
   * Cleanup all watchers
   */
  cleanup(): void {
    // Clear debounce timers
    for (const timer of this.debounceTimers.values()) {
      this.deps.timer.clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Close all watchers
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
    this.watchedFiles.clear();

    log.info('All watchers cleaned up');
  }

  /**
   * Generate a unique key for a watched file
   */
  private getFileKey(sessionDir: string, relativePath: string): string {
    return `${normalize(sessionDir)}:${normalize(relativePath)}`;
  }

  /**
   * Check if file extension is allowed
   */
  private isAllowedExtension(path: string): boolean {
    if (this.options.allowedExtensions.length === 0) {
      return true;
    }
    const lowerPath = path.toLowerCase();
    return this.options.allowedExtensions.some((ext) =>
      lowerPath.endsWith(ext.toLowerCase())
    );
  }

  /**
   * Emit a file change event (debounced)
   */
  private emitChange(session: string, relativePath: string): void {
    const key = `${session}:${relativePath}`;

    // Clear existing timer
    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      this.deps.timer.clearTimeout(existingTimer);
    }

    // Set new debounced timer
    const timer = this.deps.timer.setTimeout(() => {
      this.debounceTimers.delete(key);

      const event: FileChangeEvent = {
        type: 'change',
        session,
        path: relativePath,
        timestamp: Date.now()
      };

      log.debug(`File changed: ${session}/${relativePath}`);

      // Notify all listeners
      for (const listener of this.changeListeners) {
        try {
          listener(event);
        } catch (err) {
          log.error('Error in change listener:', err);
        }
      }
    }, this.options.debounceMs);

    this.debounceTimers.set(key, timer);
  }
}

// =============================================================================
// Module-level singleton for backward compatibility
// =============================================================================

let defaultService: FileWatcherService | null = null;

function getDefaultService(): FileWatcherService {
  if (!defaultService) {
    defaultService = new FileWatcherService();
  }
  return defaultService;
}

/** Watch a file for changes (backward compatible) */
export function watchFile(
  sessionDir: string,
  relativePath: string,
  sessionName: string,
  client: unknown
): boolean {
  return getDefaultService().watchFile(sessionDir, relativePath, sessionName, client);
}

/** Stop watching a file for a client (backward compatible) */
export function unwatchFile(sessionDir: string, relativePath: string, client: unknown): void {
  getDefaultService().unwatchFile(sessionDir, relativePath, client);
}

/** Remove all watches for a client (backward compatible) */
export function unwatchAllForClient(client: unknown): void {
  getDefaultService().unwatchAllForClient(client);
}

/** Register a file change listener (backward compatible) */
export function onFileChange(callback: (event: FileChangeEvent) => void): () => void {
  return getDefaultService().onFileChange(callback);
}

/** Configure the watcher (backward compatible) */
export function configureWatcher(newOptions: Partial<PreviewOptions>): void {
  getDefaultService().configure(newOptions);
}

/** Get watcher statistics (backward compatible) */
export function getWatcherStats(): { watchedFiles: number; activeClients: number } {
  return getDefaultService().getStats();
}

/** Cleanup all watchers (backward compatible) */
export function cleanupWatchers(): void {
  if (defaultService) {
    defaultService.cleanup();
    defaultService = null;
  }
}

/** Reset default service (for testing) */
export function resetDefaultService(): void {
  if (defaultService) {
    defaultService.cleanup();
    defaultService = null;
  }
}
