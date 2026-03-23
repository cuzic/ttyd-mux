/**
 * Extension Message Types
 *
 * WebSocket message types for optional features (claude-watcher, etc.).
 * These types live in core/protocol so that ServerMessage union can reference
 * them without importing from features/.
 *
 * Feature modules re-export these types from their own type files.
 */

/** Claude user message */
export interface ClaudeUserMessageWS {
  type: 'claudeUserMessage';
  uuid: string;
  content: string;
  timestamp: string;
  sessionId: string;
}

/** Claude assistant text */
export interface ClaudeAssistantTextWS {
  type: 'claudeAssistantText';
  uuid: string;
  text: string;
  timestamp: string;
}

/** Claude thinking process */
export interface ClaudeThinkingWS {
  type: 'claudeThinking';
  uuid: string;
  thinking: string;
  timestamp: string;
}

/** Claude tool use */
export interface ClaudeToolUseWS {
  type: 'claudeToolUse';
  uuid: string;
  toolId: string;
  toolName: string;
  input: Record<string, unknown>;
  timestamp: string;
}

/** Claude tool result */
export interface ClaudeToolResultWS {
  type: 'claudeToolResult';
  uuid: string;
  toolId: string;
  content: string;
  isError: boolean;
  timestamp: string;
}

/** Claude session start */
export interface ClaudeSessionStartWS {
  type: 'claudeSessionStart';
  sessionId: string;
  project: string;
  slug?: string;
  timestamp: string;
}

/** Claude session end */
export interface ClaudeSessionEndWS {
  type: 'claudeSessionEnd';
  sessionId: string;
  timestamp: string;
}

/** All Claude watcher message types */
export type ClaudeWatcherMessage =
  | ClaudeUserMessageWS
  | ClaudeAssistantTextWS
  | ClaudeThinkingWS
  | ClaudeToolUseWS
  | ClaudeToolResultWS
  | ClaudeSessionStartWS
  | ClaudeSessionEndWS;
