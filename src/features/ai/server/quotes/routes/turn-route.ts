/**
 * Turn Route
 *
 * GET /api/claude-quotes/turn/:uuid - Get full turn content
 */

import {
  type QuoteRouteContext,
  successResponse,
  failureResponse,
  handleError,
  resolveSession
} from './types.js';
import {
  getClaudeTurnByUuid,
  getClaudeTurnByUuidFromSession
} from '../quotes-service.js';

/**
 * Handle /turn/:uuid route
 *
 * Success: ClaudeTurn object
 * Error: { error: string } with appropriate status code
 */
export async function handleTurnRoute(
  ctx: QuoteRouteContext,
  uuid: string
): Promise<Response> {
  const claudeSessionId = ctx.params.get('claudeSessionId');
  const projectPath = ctx.params.get('projectPath');

  // Use claudeSessionId + projectPath if provided (new approach)
  if (claudeSessionId && projectPath) {
    try {
      const turn = await getClaudeTurnByUuidFromSession(projectPath, claudeSessionId, uuid);
      return turn
        ? successResponse(turn, ctx.headers)
        : failureResponse('Turn not found', ctx.headers, 404);
    } catch (error) {
      return handleError(error, ctx.headers);
    }
  }

  // Fallback: legacy approach using bunterm session name
  const sessionResult = resolveSession(ctx);
  if (!sessionResult.ok) {
    return failureResponse(
      sessionResult.status === 400
        ? 'Either (claudeSessionId + projectPath) or session parameter is required'
        : sessionResult.error,
      ctx.headers,
      sessionResult.status
    );
  }

  try {
    const turn = await getClaudeTurnByUuid(sessionResult.cwd, uuid);
    return turn
      ? successResponse(turn, ctx.headers)
      : failureResponse('Turn not found', ctx.headers, 404);
  } catch (error) {
    return handleError(error, ctx.headers);
  }
}
