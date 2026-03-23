/**
 * Agent Timeline Service
 *
 * Subscribes to ClaudeSessionWatcher events from all terminal sessions
 * and converts them to unified AgentTimelineEvent format.
 * Provides subscription and history APIs for SSE streaming.
 */

import type { ClaudeWatcherMessage } from '@/core/protocol/extension-messages.js';
import type { NativeSessionManager } from '@/core/server/session-manager.js';
import type { FileConflict } from './file-conflict-detector.js';
import { FileConflictDetector } from './file-conflict-detector.js';
import type { AgentTimelineEvent } from './types.js';

/** Maximum events to keep in the buffer */
const MAX_BUFFER_SIZE = 200;

/** Maximum summary length */
const MAX_SUMMARY_LENGTH = 100;

type TimelineEventListener = (event: AgentTimelineEvent) => void;

/** Callback invoked when an error-severity event is added */
export type ErrorEventCallback = (event: AgentTimelineEvent) => void;

let eventCounter = 0;

function generateEventId(): string {
  return `tle_${Date.now().toString(36)}_${(++eventCounter).toString(36)}`;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
}

/**
 * Convert a ClaudeWatcherMessage to an AgentTimelineEvent.
 */
export function convertMessage(agentName: string, msg: ClaudeWatcherMessage): AgentTimelineEvent {
  const base = {
    id: generateEventId(),
    agentName,
    timestamp: 'timestamp' in msg ? msg.timestamp : new Date().toISOString()
  };

  switch (msg.type) {
    case 'claudeToolUse':
      return {
        ...base,
        eventType: 'toolUse',
        summary: truncate(`Tool: ${msg.toolName}`, MAX_SUMMARY_LENGTH),
        detail: JSON.stringify(msg.input),
        severity: 'info'
      };

    case 'claudeToolResult':
      if (msg.isError) {
        return {
          ...base,
          eventType: 'error',
          summary: truncate('Tool error', MAX_SUMMARY_LENGTH),
          detail: msg.content,
          severity: 'error'
        };
      }
      return {
        ...base,
        eventType: 'toolResult',
        summary: truncate('Tool result', MAX_SUMMARY_LENGTH),
        detail: msg.content,
        severity: 'info'
      };

    case 'claudeAssistantText':
      return {
        ...base,
        eventType: 'text',
        summary: truncate(msg.text, MAX_SUMMARY_LENGTH),
        severity: 'info'
      };

    case 'claudeThinking':
      return {
        ...base,
        eventType: 'thinking',
        summary: truncate(msg.thinking, MAX_SUMMARY_LENGTH),
        severity: 'info'
      };

    case 'claudeSessionStart':
      return {
        ...base,
        eventType: 'sessionStart',
        summary: `Session started: ${msg.sessionId}`,
        severity: 'info'
      };

    case 'claudeSessionEnd':
      return {
        ...base,
        eventType: 'sessionEnd',
        summary: `Session ended: ${msg.sessionId}`,
        severity: 'info'
      };

    case 'claudeUserMessage':
      return {
        ...base,
        eventType: 'text',
        summary: truncate(`User: ${msg.content}`, MAX_SUMMARY_LENGTH),
        severity: 'info'
      };
  }
}

/**
 * AgentTimelineService subscribes to all sessions' ClaudeSessionWatcher events
 * and provides a unified event stream.
 */
export interface AgentTimelineServiceOptions {
  sessionManager: NativeSessionManager;
  onErrorEvent?: ErrorEventCallback;
}

export class AgentTimelineService {
  private events: AgentTimelineEvent[] = [];
  private subscribers: Set<TimelineEventListener> = new Set();
  private watcherCleanups: Map<string, () => void> = new Map();
  private readonly sessionManager: NativeSessionManager;
  private readonly onErrorEvent?: ErrorEventCallback;
  private readonly conflictDetector: FileConflictDetector;
  private conflictCleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: AgentTimelineServiceOptions) {
    this.sessionManager = options.sessionManager;
    this.onErrorEvent = options.onErrorEvent;
    this.conflictDetector = new FileConflictDetector();
    this.attachToExistingSessions();

    // Periodically clean up stale conflict entries (every 60s)
    this.conflictCleanupTimer = setInterval(() => {
      this.conflictDetector.cleanup();
    }, 60_000);
  }

  /**
   * Subscribe to timeline events.
   * Returns an unsubscribe function.
   */
  subscribe(callback: TimelineEventListener): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Get event history.
   * If limit is specified, returns the most recent `limit` events.
   */
  getHistory(limit?: number): AgentTimelineEvent[] {
    if (limit === undefined) {
      return [...this.events];
    }
    return this.events.slice(-limit);
  }

  /**
   * Get current file conflicts from the conflict detector.
   */
  getConflicts(): FileConflict[] {
    return this.conflictDetector.getConflicts();
  }

  /**
   * Clean up all subscriptions and listeners.
   */
  dispose(): void {
    // Remove all watcher listeners
    for (const cleanup of this.watcherCleanups.values()) {
      cleanup();
    }
    this.watcherCleanups.clear();
    this.subscribers.clear();
    this.events = [];

    if (this.conflictCleanupTimer) {
      clearInterval(this.conflictCleanupTimer);
      this.conflictCleanupTimer = null;
    }
  }

  /**
   * Attach to all existing sessions' claude watchers.
   */
  private attachToExistingSessions(): void {
    const names = this.sessionManager.getSessionNames();
    for (const name of names) {
      this.attachToSession(name);
    }
  }

  /**
   * Attach to a single session's claude watcher.
   */
  private attachToSession(sessionName: string): void {
    const session = this.sessionManager.getSession(sessionName);
    if (!session) {
      return;
    }

    // biome-ignore lint: controller/emitter lacks typed property
    const watcher = (session as any).claudeWatcher;
    if (!watcher) {
      return;
    }

    const handler = (msg: ClaudeWatcherMessage) => {
      const event = convertMessage(sessionName, msg);
      this.trackConflicts(sessionName, msg);
      this.addEvent(event);
    };

    watcher.on('message', handler);
    this.watcherCleanups.set(sessionName, () => {
      watcher.removeListener('message', handler);
    });
  }

  /**
   * Extract file path from a toolUse message and track it for conflict detection.
   */
  private trackConflicts(agentName: string, msg: ClaudeWatcherMessage): void {
    if (msg.type !== 'claudeToolUse') {
      return;
    }

    const filePath = msg.input?.['file_path'] as string | undefined;
    if (filePath) {
      this.conflictDetector.trackFileEdit(agentName, msg.toolName, filePath);
    }
  }

  /**
   * Add an event to the buffer and notify subscribers.
   */
  private addEvent(event: AgentTimelineEvent): void {
    this.events.push(event);

    // Trim buffer
    if (this.events.length > MAX_BUFFER_SIZE) {
      this.events = this.events.slice(-MAX_BUFFER_SIZE);
    }

    // Notify subscribers
    for (const subscriber of this.subscribers) {
      try {
        subscriber(event);
      } catch (_error) {
        // Don't let subscriber errors crash the service
      }
    }

    // Trigger push notification for error events
    if (event.severity === 'error' && this.onErrorEvent) {
      try {
        this.onErrorEvent(event);
      } catch (_error) {
        // Don't let notification errors crash the service
      }
    }
  }
}
