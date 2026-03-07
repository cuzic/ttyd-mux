/**
 * Block Types for Warp-style Block UI
 *
 * Defines block data structures and related messages for command
 * grouping and visualization.
 */

// === Block Types ===

/** Basic block status for interactive UI */
export type BlockStatus = 'running' | 'success' | 'error';

/** Extended block status for Command Block API */
export type ExtendedBlockStatus =
  | 'queued'
  | 'running'
  | 'success'
  | 'error'
  | 'timeout'
  | 'canceled';

/** Execution mode for command execution */
export type ExecutionMode = 'ephemeral' | 'persistent';

/** How the command was submitted */
export type SubmissionSource = 'api' | 'interactive';

/** Error type classification */
export type BlockErrorType = 'nonzero' | 'timeout' | 'canceled' | 'marker_missing';

/** Git repository information captured at execution time */
export interface GitInfo {
  head: string; // Commit hash
  dirty: boolean; // Has uncommitted changes
  repoRoot: string; // Repository root path
}

/** Agent metadata for tracking */
export interface AgentMeta {
  agentId: string;
  contextId?: string;
  requestId?: string;
}

/** Basic block for interactive UI (original interface) */
export interface Block {
  id: string;
  command: string;
  output: string; // Base64 encoded terminal output
  startedAt: string;
  endedAt?: string;
  exitCode?: number;
  cwd?: string;
  status: BlockStatus;
  startLine: number; // Terminal row where block starts
  endLine?: number; // Terminal row where block ends
}

/** Extended block for Command Block API */
export interface ExtendedBlock {
  // Identification
  id: string;
  correlationId?: string;

  // Command information
  command: string;
  mode: ExecutionMode;
  submittedVia: SubmissionSource;

  // Environment (for reproducibility)
  requestedCwd?: string;
  requestedEnv?: Record<string, string>;
  effectiveCwd?: string;
  gitInfo?: GitInfo;

  // Output (preview only, full content in chunks)
  stdoutPreview: string; // First 500 characters
  stderrPreview: string;
  stdoutBytes: number;
  stderrBytes: number;
  truncated: boolean;

  // Status
  status: ExtendedBlockStatus;
  exitCode?: number;
  errorType?: BlockErrorType;

  // Timing
  startedAt: string;
  endedAt?: string;
  durationMs?: number;

  // Metadata
  tags?: string[];
  agentMeta?: AgentMeta;
  pinned?: boolean;

  // UI (for persistent mode)
  startLine?: number;
  endLine?: number;
}

/** Output chunk for streaming and storage */
export interface OutputChunk {
  id: string;
  blockId: string;
  stream: 'stdout' | 'stderr';
  seq: number; // Monotonically increasing sequence number
  content: string; // Base64 encoded
  timestamp: string;
}

/** Command execution request */
export interface CommandRequest {
  command: string;
  mode?: ExecutionMode; // default: 'ephemeral'
  cwd?: string;
  env?: Record<string, string>;
  tags?: string[];
  agentMeta?: AgentMeta;
  timeoutMs?: number; // default: 300000 (5 minutes)
  captureGitInfo?: boolean; // default: true
}

/** Command execution response */
export interface CommandResponse {
  blockId: string;
  correlationId: string;
  status: ExtendedBlockStatus;
}

/** OSC 633 shell integration status */
export interface IntegrationStatus {
  osc633: boolean;
  shellType?: 'bash' | 'zsh' | 'fish' | 'unknown';
  testedAt: string;
  status: 'healthy' | 'contaminated' | 'error';
  errorReason?: string;
}

/** Block retention policy configuration */
export interface RetentionPolicy {
  // Ring buffer
  maxRecentBlocks: number; // Default: 100, per session

  // Failed block retention
  maxFailedBlocks: number; // Default: 200
  failedRetentionDays: number; // Default: 30

  // Full output retention
  fullOutputRecentCount: number; // Default: 20
  olderBlocksPreviewOnly: boolean; // Default: true

  // Pinned blocks
  maxPinnedBlocks: number; // Default: 50
}

/** Default retention policy */
export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  maxRecentBlocks: 100,
  maxFailedBlocks: 200,
  failedRetentionDays: 30,
  fullOutputRecentCount: 20,
  olderBlocksPreviewOnly: true,
  maxPinnedBlocks: 50
};

/** Block cancel request */
export interface CancelRequest {
  signal?: 'SIGTERM' | 'SIGINT' | 'SIGKILL';
}

/** Block cancel response */
export interface CancelResponse {
  success: boolean;
  blockId: string;
  signal: string;
  sessionStatus: 'healthy' | 'contaminated';
}

/** Chunk query parameters */
export interface ChunkQueryParams {
  fromSeq?: number;
  stream?: 'stdout' | 'stderr' | 'all';
  limit?: number; // default: 100
}

/** Chunk query response */
export interface ChunkQueryResponse {
  chunks: OutputChunk[];
  hasMore: boolean;
}

/** SSE event types */
export type BlockEventType =
  | 'block.queued'
  | 'block.started'
  | 'block.stdout'
  | 'block.stderr'
  | 'block.completed'
  | 'block.canceled'
  | 'block.timeout';

/** SSE event data */
export interface BlockEvent {
  type: BlockEventType;
  blockId: string;
  seq: number;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface BlockSession {
  blocks: Block[];
  activeBlockId: string | null;
}

// === Block Messages (Server → Client) ===

export interface BlockStartMessage {
  type: 'blockStart';
  block: Block;
}

export interface BlockEndMessage {
  type: 'blockEnd';
  blockId: string;
  exitCode: number;
  endedAt: string;
  endLine: number;
}

export interface BlockOutputMessage {
  type: 'blockOutput';
  blockId: string;
  data: string; // Base64 encoded
}

export interface BlockListMessage {
  type: 'blockList';
  blocks: Block[];
}
