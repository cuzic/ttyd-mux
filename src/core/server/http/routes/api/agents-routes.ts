/**
 * Agents API Routes
 *
 * Provides agent status and timeline event streaming from Claude watchers.
 */

import type { RouteContext, RouteDef } from '@/core/server/http/route-types.js';
import { securityHeaders } from '@/core/server/http/utils.js';
import { getAgentStatuses } from '@/features/agent-timeline/server/agent-status.js';
import type { AgentTimelineService } from '@/features/agent-timeline/server/timeline-service.js';
import type { AgentTimelineEvent } from '@/features/agent-timeline/server/types.js';
import { ok } from '@/utils/result.js';

// --- Shared timeline service reference (set during server init) ---

let sharedTimelineService: AgentTimelineService | null = null;

/**
 * Set the shared AgentTimelineService instance.
 * Called during server initialization.
 */
export function setTimelineService(service: AgentTimelineService): void {
  sharedTimelineService = service;
}

/**
 * Get the shared AgentTimelineService instance (for testing).
 */
export function getTimelineService(): AgentTimelineService | null {
  return sharedTimelineService;
}

// --- Route Definitions ---

export const agentsRoutes: RouteDef[] = [
  {
    method: 'GET',
    path: '/api/agents/status',
    description: 'Get agent status for all sessions',
    tags: ['agents'],
    handler: (ctx) => {
      const statuses = getAgentStatuses(ctx.sessionManager);
      return ok(statuses);
    }
  },
  {
    method: 'GET',
    path: '/api/agents/conflicts',
    description: 'Get current file conflicts between agents',
    tags: ['agents'],
    handler: () => {
      if (!sharedTimelineService) {
        return ok([]);
      }
      return ok(sharedTimelineService.getConflicts());
    }
  },
  {
    method: 'GET',
    path: '/api/agents/timeline/history',
    description: 'Get agent timeline event history',
    tags: ['agents'],
    handler: (ctx) => {
      if (!sharedTimelineService) {
        return ok([]);
      }
      const url = new URL(ctx.req.url);
      const limitParam = url.searchParams.get('limit');
      const limit = limitParam ? parseInt(limitParam, 10) : 50;
      const events = sharedTimelineService.getHistory(limit);
      return ok(events);
    }
  }
];

// --- SSE Stream Handler ---

/**
 * Format an AgentTimelineEvent as SSE data.
 */
function formatTimelineSSE(event: AgentTimelineEvent): string {
  const lines: string[] = [];
  lines.push(`id: ${event.id}`);
  lines.push(`event: ${event.eventType}`);
  lines.push(`data: ${JSON.stringify(event)}`);
  lines.push('');
  return `${lines.join('\n')}\n`;
}

/**
 * Handle SSE stream for agent timeline events.
 * Returns a streaming Response directly (not routed through JSON executor).
 */
export function handleTimelineStream(ctx: RouteContext): Response {
  if (!sharedTimelineService) {
    return new Response(JSON.stringify({ error: 'Timeline service not initialized' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...securityHeaders(ctx.sentryEnabled) }
    });
  }

  const service = sharedTimelineService;
  const encoder = new TextEncoder();

  let cleanupFn: (() => void) | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Send initial comment to establish connection
      controller.enqueue(encoder.encode(': connected\n\n'));

      // Subscribe to timeline events
      cleanupFn = service.subscribe((event) => {
        try {
          controller.enqueue(encoder.encode(formatTimelineSSE(event)));
        } catch (_error) {
          // Stream may be closed
        }
      });
    },
    cancel() {
      cleanupFn?.();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...securityHeaders(ctx.sentryEnabled)
    }
  });
}
