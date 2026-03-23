/**
 * Agent Status Service Tests
 *
 * Tests for getAgentStatuses which collects Claude watcher status
 * from all terminal sessions.
 */

import { describe, expect, test } from 'bun:test';
import type { AgentStatus } from './agent-status.js';
import { getAgentStatuses } from './agent-status.js';

// === Test Helpers ===

/** Minimal mock for ClaudeSessionWatcher status */
function createMockSession(
  name: string,
  cwd: string,
  watcherStatus: { lastMessage?: { type: string; timestamp: string }; sessionId: string | null }
) {
  return {
    name,
    cwd,
    claudeWatcherStatus: watcherStatus
  };
}

/** Creates a mock NativeSessionManager with given sessions */
function createMockSessionManager(sessions: ReturnType<typeof createMockSession>[]) {
  const sessionMap = new Map<string, ReturnType<typeof createMockSession>>();
  for (const s of sessions) {
    sessionMap.set(s.name, s);
  }
  return {
    getSessionNames(): string[] {
      return Array.from(sessionMap.keys());
    },
    getSession(name: string) {
      return sessionMap.get(name);
    }
  };
}

// === Tests ===

describe('getAgentStatuses', () => {
  test('returns empty array when no sessions exist', () => {
    const manager = createMockSessionManager([]);
    // biome-ignore lint: test mock type
    const result = getAgentStatuses(manager as any);
    expect(result).toEqual([]);
  });

  test('returns unknown status when session has no claude watcher activity', () => {
    const manager = createMockSessionManager([
      createMockSession('dev', '/home/user/project', {
        sessionId: null,
        lastMessage: undefined
      })
    ]);

    // biome-ignore lint: test mock type
    const result = getAgentStatuses(manager as any);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      sessionName: 'dev',
      status: 'unknown',
      lastActivity: undefined,
      lastTool: undefined
    } satisfies AgentStatus);
  });

  test('returns active status when last activity was within 30 seconds', () => {
    const now = new Date();
    const recentTimestamp = new Date(now.getTime() - 10_000).toISOString(); // 10s ago

    const manager = createMockSessionManager([
      createMockSession('dev', '/home/user/project', {
        sessionId: 'session-1',
        lastMessage: { type: 'claudeToolUse', timestamp: recentTimestamp }
      })
    ]);

    // biome-ignore lint: test mock type
    const result = getAgentStatuses(manager as any);
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe('active');
    expect(result[0]?.lastActivity).toBe(recentTimestamp);
  });

  test('returns idle status when last activity was over 30 seconds ago', () => {
    const now = new Date();
    const oldTimestamp = new Date(now.getTime() - 60_000).toISOString(); // 60s ago

    const manager = createMockSessionManager([
      createMockSession('dev', '/home/user/project', {
        sessionId: 'session-1',
        lastMessage: { type: 'claudeAssistantText', timestamp: oldTimestamp }
      })
    ]);

    // biome-ignore lint: test mock type
    const result = getAgentStatuses(manager as any);
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe('idle');
  });

  test('returns error status when last event was a tool result with error', () => {
    const now = new Date();
    const recentTimestamp = new Date(now.getTime() - 5_000).toISOString();

    const manager = createMockSessionManager([
      createMockSession('dev', '/home/user/project', {
        sessionId: 'session-1',
        lastMessage: { type: 'claudeToolResultError', timestamp: recentTimestamp }
      })
    ]);

    // biome-ignore lint: test mock type
    const result = getAgentStatuses(manager as any);
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe('error');
  });

  test('returns lastTool when last message was a tool use', () => {
    const now = new Date();
    const recentTimestamp = new Date(now.getTime() - 5_000).toISOString();

    const manager = createMockSessionManager([
      createMockSession('dev', '/home/user/project', {
        sessionId: 'session-1',
        lastMessage: { type: 'claudeToolUse', timestamp: recentTimestamp, toolName: 'Edit' }
      })
    ]);

    // biome-ignore lint: test mock type
    const result = getAgentStatuses(manager as any);
    expect(result[0]?.lastTool).toBe('Edit');
  });

  test('handles multiple sessions with different statuses', () => {
    const now = new Date();

    const manager = createMockSessionManager([
      createMockSession('active-session', '/home/user/proj1', {
        sessionId: 'session-1',
        lastMessage: {
          type: 'claudeToolUse',
          timestamp: new Date(now.getTime() - 5_000).toISOString()
        }
      }),
      createMockSession('idle-session', '/home/user/proj2', {
        sessionId: 'session-2',
        lastMessage: {
          type: 'claudeAssistantText',
          timestamp: new Date(now.getTime() - 120_000).toISOString()
        }
      }),
      createMockSession('no-claude', '/home/user/proj3', {
        sessionId: null,
        lastMessage: undefined
      })
    ]);

    // biome-ignore lint: test mock type
    const result = getAgentStatuses(manager as any);
    expect(result).toHaveLength(3);

    const byName = Object.fromEntries(result.map((s) => [s.sessionName, s.status]));
    expect(byName['active-session']).toBe('active');
    expect(byName['idle-session']).toBe('idle');
    expect(byName['no-claude']).toBe('unknown');
  });
});
