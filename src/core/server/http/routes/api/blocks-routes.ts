/**
 * Blocks API Routes
 *
 * Handles command block operations: execute, cancel, stream.
 */

import type { ApiContext } from './types.js';
import { jsonResponse, errorResponse } from '../../utils.js';
import type { CommandRequest } from '@/core/protocol/index.js';
import {
  type CommandExecutorManager,
  createCommandExecutorManager
} from '@/core/terminal/command-executor-manager.js';
import { createBlockSSEStream } from '@/features/blocks/server/block-event-emitter.js';
import type { NativeSessionManager } from '@/core/server/session-manager.js';

// Command executor manager (lazy initialized)
let executorManager: CommandExecutorManager | null = null;

/**
 * Get or create the command executor manager
 */
export function getExecutorManager(sessionManager: NativeSessionManager): CommandExecutorManager {
  if (!executorManager) {
    executorManager = createCommandExecutorManager(sessionManager);
  }
  return executorManager;
}

/**
 * Handle blocks API routes
 */
export async function handleBlocksRoutes(ctx: ApiContext): Promise<Response | null> {
  const { apiPath, method, req, sessionManager, sentryEnabled } = ctx;

  // POST /api/sessions/:name/commands - Execute a command
  const commandsMatch = apiPath.match(/^\/sessions\/([^/]+)\/commands$/);
  if (commandsMatch?.[1] && method === 'POST') {
    const sessionName = decodeURIComponent(commandsMatch[1]);

    if (!sessionManager.hasSession(sessionName)) {
      return errorResponse(`Session "${sessionName}" not found`, 404, sentryEnabled);
    }

    try {
      const body = (await req.json()) as CommandRequest;

      if (!body.command || typeof body.command !== 'string') {
        return errorResponse('command is required', 400, sentryEnabled);
      }

      const executor = getExecutorManager(sessionManager);
      const response = await executor.executeCommand(sessionName, body);

      return jsonResponse(response, { status: 202, sentryEnabled });
    } catch (error) {
      return errorResponse(String(error), 500, sentryEnabled);
    }
  }

  // GET /api/sessions/:name/blocks - List blocks for a session
  const sessionBlocksMatch = apiPath.match(/^\/sessions\/([^/]+)\/blocks$/);
  if (sessionBlocksMatch?.[1] && method === 'GET') {
    const sessionName = decodeURIComponent(sessionBlocksMatch[1]);

    if (!sessionManager.hasSession(sessionName)) {
      return errorResponse(`Session "${sessionName}" not found`, 404, sentryEnabled);
    }

    const executor = getExecutorManager(sessionManager);
    const blocks = executor.getSessionBlocks(sessionName);

    return jsonResponse(blocks, { sentryEnabled });
  }

  // GET /api/sessions/:name/integration - Get OSC 633 integration status
  const integrationMatch = apiPath.match(/^\/sessions\/([^/]+)\/integration$/);
  if (integrationMatch?.[1] && method === 'GET') {
    const sessionName = decodeURIComponent(integrationMatch[1]);

    if (!sessionManager.hasSession(sessionName)) {
      return errorResponse(`Session "${sessionName}" not found`, 404, sentryEnabled);
    }

    const executor = getExecutorManager(sessionManager);
    const status = executor.getIntegrationStatus(sessionName);

    if (!status) {
      return jsonResponse(
        {
          osc633: false,
          status: 'unknown',
          testedAt: null,
          message: 'Integration not tested. Use persistent mode to test.'
        },
        { sentryEnabled }
      );
    }

    return jsonResponse(status, { sentryEnabled });
  }

  // GET /api/blocks/:blockId - Get a specific block
  const blockMatch = apiPath.match(/^\/blocks\/([^/]+)$/);
  if (blockMatch?.[1] && method === 'GET') {
    const blockId = decodeURIComponent(blockMatch[1]);

    const executor = getExecutorManager(sessionManager);
    const block = executor.getBlock(blockId);

    if (!block) {
      return errorResponse(`Block "${blockId}" not found`, 404, sentryEnabled);
    }

    return jsonResponse(block, { sentryEnabled });
  }

  // POST /api/blocks/:blockId/cancel - Cancel a running command
  const cancelMatch = apiPath.match(/^\/blocks\/([^/]+)\/cancel$/);
  if (cancelMatch?.[1] && method === 'POST') {
    const blockId = decodeURIComponent(cancelMatch[1]);

    const executor = getExecutorManager(sessionManager);
    const block = executor.getBlock(blockId);

    if (!block) {
      return errorResponse(`Block "${blockId}" not found`, 404, sentryEnabled);
    }

    try {
      const body = (await req.json().catch(() => ({}))) as {
        signal?: 'SIGTERM' | 'SIGINT' | 'SIGKILL';
      };
      const signal = body.signal ?? 'SIGTERM';

      let response = null;
      for (const session of sessionManager.listSessions()) {
        const result = executor.cancelCommand(session.name, blockId, signal);
        if (result.success) {
          response = result;
          break;
        }
      }

      if (!response) {
        return errorResponse('Block is not running or cannot be canceled', 400, sentryEnabled);
      }

      return jsonResponse(response, { sentryEnabled });
    } catch (error) {
      return errorResponse(String(error), 500, sentryEnabled);
    }
  }

  // POST /api/blocks/:blockId/pin - Pin a block
  const pinMatch = apiPath.match(/^\/blocks\/([^/]+)\/pin$/);
  if (pinMatch?.[1] && method === 'POST') {
    const blockId = decodeURIComponent(pinMatch[1]);

    const executor = getExecutorManager(sessionManager);
    const success = executor.pinBlock(blockId);

    if (!success) {
      return errorResponse(`Block "${blockId}" not found`, 404, sentryEnabled);
    }

    return jsonResponse({ success: true, blockId }, { sentryEnabled });
  }

  // DELETE /api/blocks/:blockId/pin - Unpin a block
  if (pinMatch?.[1] && method === 'DELETE') {
    const blockId = decodeURIComponent(pinMatch[1]);

    const executor = getExecutorManager(sessionManager);
    const success = executor.unpinBlock(blockId);

    if (!success) {
      return errorResponse(`Block "${blockId}" not found`, 404, sentryEnabled);
    }

    return jsonResponse({ success: true, blockId }, { sentryEnabled });
  }

  // GET /api/blocks/:blockId/chunks - Get output chunks
  const chunksMatch = apiPath.match(/^\/blocks\/([^/]+)\/chunks$/);
  if (chunksMatch?.[1] && method === 'GET') {
    const blockId = decodeURIComponent(chunksMatch[1]);
    const params = new URL(req.url).searchParams;

    const executor = getExecutorManager(sessionManager);
    const block = executor.getBlock(blockId);

    if (!block) {
      return errorResponse(`Block "${blockId}" not found`, 404, sentryEnabled);
    }

    const fromSeq = params.get('fromSeq') ? Number.parseInt(params.get('fromSeq')!, 10) : undefined;
    const stream = params.get('stream') as 'stdout' | 'stderr' | 'all' | null;
    const limit = params.get('limit') ? Number.parseInt(params.get('limit')!, 10) : undefined;

    const result = executor.getBlockChunks(blockId, {
      fromSeq,
      stream: stream ?? 'all',
      limit
    });

    return jsonResponse(result, { sentryEnabled });
  }

  // GET /api/blocks/:blockId/stream - SSE stream for block events
  const streamMatch = apiPath.match(/^\/blocks\/([^/]+)\/stream$/);
  if (streamMatch?.[1] && method === 'GET') {
    const blockId = decodeURIComponent(streamMatch[1]);

    const executor = getExecutorManager(sessionManager);
    const block = executor.getBlock(blockId);

    if (!block) {
      return new Response(JSON.stringify({ error: `Block "${blockId}" not found` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const lastEventId = req.headers.get('Last-Event-ID');
    const fromSeq = lastEventId ? Number.parseInt(lastEventId, 10) : undefined;

    const eventEmitter = executor.getEventEmitter();
    const sseStream = createBlockSSEStream(eventEmitter, blockId, { lastEventId: fromSeq });

    return new Response(sseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
      }
    });
  }

  return null;
}
