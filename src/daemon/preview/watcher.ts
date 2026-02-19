/**
 * File Watcher Service
 *
 * Watches files for changes using fs.watch and notifies subscribers.
 */

import { type FSWatcher, existsSync, watch } from 'node:fs';
import { normalize } from 'node:path';
import { createLogger } from '@/utils/logger.js';
import type WebSocket from 'ws';
import { resolveFilePath } from '../file-transfer.js';
import type { FileChangeEvent, PreviewOptions } from './types.js';

const log = createLogger('preview-watcher');

/** Debounce timers per file */
const debounceTimers = new Map<string, NodeJS.Timeout>();

/** Watched file info */
interface WatchedFile {
  sessionDir: string;
  relativePath: string;
  fullPath: string;
  clients: Set<WebSocket>;
}

/** Active file watchers */
const watchers = new Map<string, FSWatcher>();

/** Watched files tracking */
const watchedFiles = new Map<string, WatchedFile>();

/** Change event listeners */
const changeListeners: Array<(event: FileChangeEvent) => void> = [];

/** Default options */
const DEFAULT_OPTIONS: PreviewOptions = {
  debounceMs: 300,
  allowedExtensions: ['.html', '.htm']
};

let options: PreviewOptions = DEFAULT_OPTIONS;

/**
 * Generate a unique key for a watched file
 */
function getFileKey(sessionDir: string, relativePath: string): string {
  return `${normalize(sessionDir)}:${normalize(relativePath)}`;
}

/**
 * Check if file extension is allowed
 */
function isAllowedExtension(path: string): boolean {
  if (options.allowedExtensions.length === 0) {
    return true;
  }
  const lowerPath = path.toLowerCase();
  return options.allowedExtensions.some((ext) => lowerPath.endsWith(ext.toLowerCase()));
}

/**
 * Emit a file change event (debounced)
 */
function emitChange(session: string, relativePath: string): void {
  const key = `${session}:${relativePath}`;

  // Clear existing timer
  const existingTimer = debounceTimers.get(key);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  // Set new debounced timer
  const timer = setTimeout(() => {
    debounceTimers.delete(key);

    const event: FileChangeEvent = {
      type: 'change',
      session,
      path: relativePath,
      timestamp: Date.now()
    };

    log.debug(`File changed: ${session}/${relativePath}`);

    // Notify all listeners
    for (const listener of changeListeners) {
      try {
        listener(event);
      } catch (err) {
        log.error('Error in change listener:', err);
      }
    }
  }, options.debounceMs);

  debounceTimers.set(key, timer);
}

/**
 * Watch a file for changes
 */
export function watchFile(
  sessionDir: string,
  relativePath: string,
  sessionName: string,
  client: WebSocket
): boolean {
  // Validate extension
  if (!isAllowedExtension(relativePath)) {
    log.warn(`Extension not allowed for preview: ${relativePath}`);
    return false;
  }

  // Resolve and validate path
  const fullPath = resolveFilePath(sessionDir, relativePath);
  if (!fullPath) {
    log.warn(`Invalid path for watch: ${relativePath}`);
    return false;
  }

  // Check if file exists
  if (!existsSync(fullPath)) {
    log.warn(`File not found for watch: ${fullPath}`);
    return false;
  }

  const key = getFileKey(sessionDir, relativePath);

  // Check if already watching
  let watchedFile = watchedFiles.get(key);
  if (watchedFile) {
    // Add client to existing watch
    watchedFile.clients.add(client);
    log.debug(`Added client to existing watch: ${key}`);
    return true;
  }

  // Create new watcher
  try {
    const watcher = watch(fullPath, (eventType) => {
      if (eventType === 'change') {
        emitChange(sessionName, relativePath);
      }
    });

    watcher.on('error', (err) => {
      log.error(`Watcher error for ${fullPath}:`, err);
      unwatchFile(sessionDir, relativePath, client);
    });

    watchers.set(key, watcher);

    watchedFile = {
      sessionDir,
      relativePath,
      fullPath,
      clients: new Set([client])
    };
    watchedFiles.set(key, watchedFile);

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
export function unwatchFile(sessionDir: string, relativePath: string, client: WebSocket): void {
  const key = getFileKey(sessionDir, relativePath);
  const watchedFile = watchedFiles.get(key);

  if (!watchedFile) {
    return;
  }

  // Remove client
  watchedFile.clients.delete(client);

  // If no more clients, stop watching
  if (watchedFile.clients.size === 0) {
    const watcher = watchers.get(key);
    if (watcher) {
      watcher.close();
      watchers.delete(key);
    }
    watchedFiles.delete(key);
    log.info(`Stopped watching: ${key}`);
  }
}

/**
 * Remove all watches for a client
 */
export function unwatchAllForClient(client: WebSocket): void {
  for (const [key, watchedFile] of watchedFiles.entries()) {
    if (watchedFile.clients.has(client)) {
      watchedFile.clients.delete(client);

      // If no more clients, stop watching
      if (watchedFile.clients.size === 0) {
        const watcher = watchers.get(key);
        if (watcher) {
          watcher.close();
          watchers.delete(key);
        }
        watchedFiles.delete(key);
        log.debug(`Stopped watching (client disconnected): ${key}`);
      }
    }
  }
}

/**
 * Register a file change listener
 */
export function onFileChange(callback: (event: FileChangeEvent) => void): () => void {
  changeListeners.push(callback);
  return () => {
    const index = changeListeners.indexOf(callback);
    if (index !== -1) {
      changeListeners.splice(index, 1);
    }
  };
}

/**
 * Configure the watcher
 */
export function configureWatcher(newOptions: Partial<PreviewOptions>): void {
  options = { ...options, ...newOptions };
  log.debug('Watcher configured:', options);
}

/**
 * Get watcher statistics
 */
export function getWatcherStats(): { watchedFiles: number; activeClients: number } {
  let activeClients = 0;
  for (const file of watchedFiles.values()) {
    activeClients += file.clients.size;
  }
  return {
    watchedFiles: watchedFiles.size,
    activeClients
  };
}

/**
 * Cleanup all watchers (for shutdown)
 */
export function cleanupWatchers(): void {
  // Clear debounce timers
  for (const timer of debounceTimers.values()) {
    clearTimeout(timer);
  }
  debounceTimers.clear();

  // Close all watchers
  for (const watcher of watchers.values()) {
    watcher.close();
  }
  watchers.clear();
  watchedFiles.clear();

  log.info('All watchers cleaned up');
}
