/**
 * Agent Status Service
 *
 * Collects Claude watcher status from all terminal sessions and
 * provides a unified view of agent activity across the system.
 */

import type { NativeSessionManager } from '@/core/server/session-manager.js';

/** Threshold in ms for considering an agent as "active" */
const ACTIVE_THRESHOLD_MS = 30_000;

export interface AgentStatus {
  sessionName: string;
  status: 'active' | 'idle' | 'error' | 'unknown';
  lastActivity?: string; // ISO 8601
  lastTool?: string; // Last tool name used
}

export interface ClaudeWatcherStatusSnapshot {
  sessionId: string | null;
  lastMessage?: {
    type: string;
    timestamp: string;
    toolName?: string;
  };
}

/**
 * Get agent statuses for all sessions.
 *
 * Reads the claudeWatcherStatus from each TerminalSession and determines
 * the current status based on the last message received.
 */
export function getAgentStatuses(sessionManager: NativeSessionManager): AgentStatus[] {
  const names = sessionManager.getSessionNames();
  const statuses: AgentStatus[] = [];

  for (const name of names) {
    const session = sessionManager.getSession(name);
    if (!session) {
      continue;
    }

    // biome-ignore lint: controller/emitter lacks typed property
    const watcherStatus = (session as any).claudeWatcherStatus as
      | ClaudeWatcherStatusSnapshot
      | undefined;
    if (!watcherStatus || !watcherStatus.lastMessage) {
      statuses.push({
        sessionName: name,
        status: 'unknown',
        lastActivity: undefined,
        lastTool: undefined
      });
      continue;
    }

    const { lastMessage } = watcherStatus;
    const status = determineStatus(lastMessage);

    statuses.push({
      sessionName: name,
      status,
      lastActivity: lastMessage.timestamp,
      lastTool: lastMessage.toolName
    });
  }

  return statuses;
}

/**
 * Determine agent status from the last watcher message.
 */
function determineStatus(lastMessage: {
  type: string;
  timestamp: string;
}): 'active' | 'idle' | 'error' {
  // Error status takes priority
  if (lastMessage.type === 'claudeToolResultError') {
    return 'error';
  }

  // Check time-based activity
  const elapsed = Date.now() - new Date(lastMessage.timestamp).getTime();
  if (elapsed <= ACTIVE_THRESHOLD_MS) {
    return 'active';
  }

  return 'idle';
}
