/**
 * AI-related Protocol Types
 *
 * Defines types for AI integration features including
 * streaming responses, citations, and command suggestions.
 */

// === AI Messages (Server → Client) ===

/** Citation in AI response */
export interface AICitation {
  blockId: string;
  reason: string;
  excerpt?: string;
}

/** Suggested command in AI response */
export interface AINextCommand {
  command: string;
  description: string;
  risk: 'safe' | 'caution' | 'dangerous';
}

/** AI stream message - incremental content (may be dropped, use ai_final for recovery) */
export interface AIStreamMessage {
  type: 'ai_stream';
  runId: string;
  seq: number;
  delta: string;
}

/** AI final message - contains full response (always sent, used for gap recovery) */
export interface AIFinalMessage {
  type: 'ai_final';
  runId: string;
  result: {
    content: string;
    citations: AICitation[];
    nextCommands: AINextCommand[];
  };
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  elapsedMs: number;
}

/** AI error message */
export interface AIErrorMessage {
  type: 'ai_error';
  runId: string;
  error: string;
  code: 'timeout' | 'canceled' | 'runner_error' | 'rate_limited' | 'unknown';
}

/** AI run started message */
export interface AIRunStartedMessage {
  type: 'ai_run_started';
  runId: string;
  runner: string;
}

export type AIMessage = AIStreamMessage | AIFinalMessage | AIErrorMessage | AIRunStartedMessage;
