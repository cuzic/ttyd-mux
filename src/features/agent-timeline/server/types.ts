/**
 * Agent Timeline Event Types
 *
 * Unified event format for agent activity timeline.
 * Converts from ClaudeWatcherMessage to a display-friendly format.
 */

export type AgentTimelineEventType =
  | 'toolUse'
  | 'toolResult'
  | 'thinking'
  | 'text'
  | 'error'
  | 'sessionStart'
  | 'sessionEnd';

export type AgentTimelineSeverity = 'info' | 'warn' | 'error';

export interface AgentTimelineEvent {
  /** Unique event ID */
  id: string;
  /** Session name (agent name) */
  agentName: string;
  /** Event type */
  eventType: AgentTimelineEventType;
  /** One-line summary */
  summary: string;
  /** Expanded detail (tool output, etc.) */
  detail?: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Severity level */
  severity: AgentTimelineSeverity;
}
