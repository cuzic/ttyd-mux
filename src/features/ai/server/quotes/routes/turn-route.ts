/**
 * Turn Route
 *
 * GET /api/claude-quotes/turn/:uuid - Get full turn content
 */

import { getClaudeTurnByUuid, getClaudeTurnByUuidFromSession } from '../quotes-service.js';
import { failureResponse, handleError, successResponse } from './response.js';
import { type QuoteRouteContext, resolveClaudeFromParams } from './types.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Handle /turn/:uuid route
 */
export async function handleTurnRoute(ctx: QuoteRouteContext, uuid: string): Promise<Response> {
  if (!uuid || !UUID_REGEX.test(uuid)) {
    return failureResponse('Invalid uuid format', ctx.headers, 400);
  }

  const claude = resolveClaudeFromParams(ctx);
  if (claude instanceof Response) return claude;

  try {
    const turn = claude.claudeSessionId
      ? await getClaudeTurnByUuidFromSession(claude.cwd, claude.claudeSessionId, uuid)
      : await getClaudeTurnByUuid(claude.cwd, uuid);

    return turn
      ? successResponse(turn, ctx.headers)
      : failureResponse('Turn not found', ctx.headers, 404);
  } catch (error) {
    return handleError(error, ctx.headers);
  }
}
