/**
 * Preview Module
 *
 * HTML preview feature with live reload using WebSocket and fs.watch.
 */

export type {
  FileChangeEvent,
  PreviewClientMessage,
  PreviewOptions,
  PreviewServerMessage,
  WatchedFile
} from './types.js';

export {
  cleanupWatchers,
  configureWatcher,
  getWatcherStats,
  onFileChange,
  unwatchAllForClient,
  unwatchFile,
  watchFile
} from './watcher.js';

export {
  cleanupPreviewWs,
  getPreviewWsStats,
  handlePreviewUpgrade
} from './ws-handler.js';
