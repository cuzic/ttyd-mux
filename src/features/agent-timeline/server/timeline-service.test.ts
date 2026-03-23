import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { ClaudeWatcherMessage } from '@/core/protocol/extension-messages.js';
import { AgentTimelineService, convertMessage } from './timeline-service.js';
import type { AgentTimelineEvent } from './types.js';

// --- Helpers ---

function createMockSession(name: string) {
  const listeners = new Map<string, ((...args: any[]) => void)[]>();
  return {
    name,
    claudeWatcher: {
      on(event: string, cb: (...args: any[]) => void) {
        const list = listeners.get(event) ?? [];
        list.push(cb);
        listeners.set(event, list);
      },
      removeListener(event: string, cb: (...args: any[]) => void) {
        const list = listeners.get(event) ?? [];
        listeners.set(
          event,
          list.filter((l) => l !== cb)
        );
      }
    },
    _emit(event: string, ...args: any[]) {
      const list = listeners.get(event) ?? [];
      for (const cb of list) {
        cb(...args);
      }
    },
    _listenerCount(event: string): number {
      return (listeners.get(event) ?? []).length;
    }
  };
}

function createMockSessionManager(sessions: ReturnType<typeof createMockSession>[]) {
  // biome-ignore lint: test mock type
  return {
    getSessionNames: () => sessions.map((s) => s.name),
    getSession: (name: string) => sessions.find((s) => s.name === name)
  } as any;
}

function makeToolUseMessage(toolName: string): ClaudeWatcherMessage {
  return {
    type: 'claudeToolUse',
    uuid: 'uuid-1',
    toolId: 'tool-1',
    toolName,
    input: { path: '/tmp/test.ts' },
    timestamp: '2026-03-22T10:00:00.000Z'
  };
}

function makeAssistantTextMessage(text: string): ClaudeWatcherMessage {
  return {
    type: 'claudeAssistantText',
    uuid: 'uuid-2',
    text,
    timestamp: '2026-03-22T10:00:01.000Z'
  };
}

function makeToolResultMessage(isError: boolean): ClaudeWatcherMessage {
  return {
    type: 'claudeToolResult',
    uuid: 'uuid-3',
    toolId: 'tool-1',
    content: isError ? 'File not found' : 'Success output',
    isError,
    timestamp: '2026-03-22T10:00:02.000Z'
  };
}

function makeThinkingMessage(): ClaudeWatcherMessage {
  return {
    type: 'claudeThinking',
    uuid: 'uuid-4',
    thinking: 'Analyzing the code structure...',
    timestamp: '2026-03-22T10:00:03.000Z'
  };
}

function makeSessionStartMessage(): ClaudeWatcherMessage {
  return {
    type: 'claudeSessionStart',
    sessionId: 'sess-123',
    project: '/home/user/project',
    timestamp: '2026-03-22T10:00:00.000Z'
  };
}

function makeSessionEndMessage(): ClaudeWatcherMessage {
  return {
    type: 'claudeSessionEnd',
    sessionId: 'sess-123',
    timestamp: '2026-03-22T10:05:00.000Z'
  };
}

function makeUserMessage(): ClaudeWatcherMessage {
  return {
    type: 'claudeUserMessage',
    uuid: 'uuid-5',
    content: 'Please fix the bug',
    timestamp: '2026-03-22T10:00:00.000Z',
    sessionId: 'sess-123'
  };
}

// --- Tests ---

describe('convertMessage', () => {
  test('converts claudeToolUse to toolUse event', () => {
    const result = convertMessage('agent-1', makeToolUseMessage('Read'));
    expect(result.agentName).toBe('agent-1');
    expect(result.eventType).toBe('toolUse');
    expect(result.summary).toContain('Read');
    expect(result.severity).toBe('info');
    expect(result.timestamp).toBe('2026-03-22T10:00:00.000Z');
    expect(result.id).toBeTruthy();
  });

  test('converts claudeAssistantText to text event', () => {
    const result = convertMessage('agent-1', makeAssistantTextMessage('Hello world'));
    expect(result.eventType).toBe('text');
    expect(result.summary).toContain('Hello world');
    expect(result.severity).toBe('info');
  });

  test('converts claudeToolResult (success) to toolResult event', () => {
    const result = convertMessage('agent-1', makeToolResultMessage(false));
    expect(result.eventType).toBe('toolResult');
    expect(result.severity).toBe('info');
    expect(result.detail).toBe('Success output');
  });

  test('converts claudeToolResult (error) to error event with error severity', () => {
    const result = convertMessage('agent-1', makeToolResultMessage(true));
    expect(result.eventType).toBe('error');
    expect(result.severity).toBe('error');
    expect(result.detail).toBe('File not found');
  });

  test('converts claudeThinking to thinking event', () => {
    const result = convertMessage('agent-1', makeThinkingMessage());
    expect(result.eventType).toBe('thinking');
    expect(result.severity).toBe('info');
  });

  test('converts claudeSessionStart to sessionStart event', () => {
    const result = convertMessage('agent-1', makeSessionStartMessage());
    expect(result.eventType).toBe('sessionStart');
    expect(result.severity).toBe('info');
  });

  test('converts claudeSessionEnd to sessionEnd event', () => {
    const result = convertMessage('agent-1', makeSessionEndMessage());
    expect(result.eventType).toBe('sessionEnd');
    expect(result.severity).toBe('info');
  });

  test('converts claudeUserMessage to text event', () => {
    const result = convertMessage('agent-1', makeUserMessage());
    expect(result.eventType).toBe('text');
    expect(result.summary).toContain('Please fix the bug');
  });

  test('truncates long summaries', () => {
    const longText = 'a'.repeat(200);
    const result = convertMessage('agent-1', makeAssistantTextMessage(longText));
    expect(result.summary.length).toBeLessThanOrEqual(103); // 100 + '...'
  });
});

describe('AgentTimelineService', () => {
  let service: AgentTimelineService;
  let sessions: ReturnType<typeof createMockSession>[];
  let sessionManager: ReturnType<typeof createMockSessionManager>;

  beforeEach(() => {
    sessions = [createMockSession('agent-1'), createMockSession('agent-2')];
    sessionManager = createMockSessionManager(sessions);
    service = new AgentTimelineService({ sessionManager });
  });

  afterEach(() => {
    service.dispose();
  });

  test('subscribes to existing sessions on construction', () => {
    // The service should have attached message listeners to each session's claudeWatcher
    expect(sessions[0]._listenerCount('message')).toBe(1);
    expect(sessions[1]._listenerCount('message')).toBe(1);
  });

  test('subscribe receives events from session watchers', () => {
    const received: AgentTimelineEvent[] = [];
    service.subscribe((event) => received.push(event));

    sessions[0]._emit('message', makeToolUseMessage('Write'));

    expect(received).toHaveLength(1);
    expect(received[0].agentName).toBe('agent-1');
    expect(received[0].eventType).toBe('toolUse');
  });

  test('unsubscribe stops receiving events', () => {
    const received: AgentTimelineEvent[] = [];
    const unsubscribe = service.subscribe((event) => received.push(event));

    sessions[0]._emit('message', makeToolUseMessage('Read'));
    expect(received).toHaveLength(1);

    unsubscribe();

    sessions[0]._emit('message', makeToolUseMessage('Write'));
    expect(received).toHaveLength(1); // No new events
  });

  test('multiple subscribers receive same event', () => {
    const received1: AgentTimelineEvent[] = [];
    const received2: AgentTimelineEvent[] = [];

    service.subscribe((event) => received1.push(event));
    service.subscribe((event) => received2.push(event));

    sessions[0]._emit('message', makeToolUseMessage('Read'));

    expect(received1).toHaveLength(1);
    expect(received2).toHaveLength(1);
  });

  test('getHistory returns buffered events', () => {
    sessions[0]._emit('message', makeToolUseMessage('Read'));
    sessions[1]._emit('message', makeAssistantTextMessage('Hello'));

    const history = service.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0].eventType).toBe('toolUse');
    expect(history[1].eventType).toBe('text');
  });

  test('getHistory respects limit parameter', () => {
    sessions[0]._emit('message', makeToolUseMessage('Read'));
    sessions[0]._emit('message', makeToolUseMessage('Write'));
    sessions[0]._emit('message', makeToolUseMessage('Grep'));

    const history = service.getHistory(2);
    expect(history).toHaveLength(2);
    // Should return the most recent 2
    expect(history[0].summary).toContain('Write');
    expect(history[1].summary).toContain('Grep');
  });

  test('buffer trims to max size (200)', () => {
    // Emit 210 events
    for (let i = 0; i < 210; i++) {
      sessions[0]._emit('message', makeToolUseMessage(`Tool_${i}`));
    }

    const history = service.getHistory();
    expect(history).toHaveLength(200);
    // Oldest events should be trimmed
    expect(history[0].summary).toContain('Tool_10');
  });

  test('dispose removes all watcher listeners', () => {
    service.dispose();

    expect(sessions[0]._listenerCount('message')).toBe(0);
    expect(sessions[1]._listenerCount('message')).toBe(0);
  });

  test('dispose clears subscribers', () => {
    const received: AgentTimelineEvent[] = [];
    service.subscribe((event) => received.push(event));

    service.dispose();

    // Events after dispose should not be received (listeners removed)
    sessions[0]._emit('message', makeToolUseMessage('Read'));
    expect(received).toHaveLength(0);
  });

  test('events from different sessions have correct agentName', () => {
    const received: AgentTimelineEvent[] = [];
    service.subscribe((event) => received.push(event));

    sessions[0]._emit('message', makeToolUseMessage('Read'));
    sessions[1]._emit('message', makeToolUseMessage('Write'));

    expect(received[0].agentName).toBe('agent-1');
    expect(received[1].agentName).toBe('agent-2');
  });
});
