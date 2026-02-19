/**
 * Preview Module Type Definitions
 *
 * Types for the HTML preview feature with live reload.
 */

import type WebSocket from 'ws';

/** File change event */
export interface FileChangeEvent {
  type: 'change';
  session: string;
  path: string;
  timestamp: number;
}

/** Client → Server messages */
export type PreviewClientMessage =
  | { action: 'watch'; session: string; path: string }
  | { action: 'unwatch'; session: string; path: string };

/** Server → Client messages */
export type PreviewServerMessage = FileChangeEvent;

/** Watched file info */
export interface WatchedFile {
  sessionDir: string;
  relativePath: string;
  fullPath: string;
  clients: Set<WebSocket>;
}

/** Preview configuration (subset from types.ts) */
export interface PreviewOptions {
  debounceMs: number;
  allowedExtensions: string[];
}
