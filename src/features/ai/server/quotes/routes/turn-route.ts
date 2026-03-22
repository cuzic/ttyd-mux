/**
 * Turn Route
 *
 * GET /api/claude-quotes/turn/:uuid - Get full turn content
 */

import { getClaudeTurnByUuid, getClaudeTurnByUuidFromSession } from '../quotes-service.js';
import { TurnParamsSchema, parseSearchParams } from './params.js';
import { failureResponse, handleError, successResponse } from './response.js';
import { type QuoteRouteContext, parseLocator, resolveClaudeContext } from './types.js';

/**
 * Validate path parameter uuid
 * Claude turn UUIDs are standard UUIDv4 format
 */
function validateUuid(uuid: string): string | null {
  if (!uuid || uuid.length === 0) {
    return 'uuid is required';
  }
  // Basic UUID format check (8-4-4-4-12 hex characters)
  // Example: 550e8400-e29b-41d4-a716-446655440000
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) {
    return 'Invalid uuid format';
  }
  return null;
}

/**
 * Handle /turn/:uuid route
 *
 * Accepts either bunterm session or Claude (claudeSessionId + projectPath).
 * Uses different query methods based on context availability.
 *
 * Success: ClaudeTurn object
 * Error: { error: string } with appropriate status code
 */
export async function handleTurnRoute(ctx: QuoteRouteContext, uuid: string): Promise<Response> {
  // Step 1: Validate path parameter
  const uuidError = validateUuid(uuid);
  if (uuidError) {
    return failureResponse(uuidError, ctx.headers, 400);
  }

  // Step 2: Validate search parameters
  const parsed = parseSearchParams(ctx.params, TurnParamsSchema);
  if (!parsed.ok) {
    return failureResponse(parsed.error, ctx.headers, 400);
  }

  // Step 3: Resolve locator
  const locator = parseLocator(ctx.params);
  if (!locator.ok) {
    return failureResponse(locator.error.error, ctx.headers, locator.error.status);
  }

  // Step 4: Resolve Claude context
  const claude = resolveClaudeContext(locator.value, ctx.sessionManager);
  if (!claude.ok) {
    return failureResponse(claude.error.error, ctx.headers, claude.error.status);
  }

  // Step 5: Execute service logic
  try {
    const turn = claude.value.claudeSessionId
      ? await getClaudeTurnByUuidFromSession(claude.value.cwd, claude.value.claudeSessionId, uuid)
      : await getClaudeTurnByUuid(claude.value.cwd, uuid);

    return turn
      ? successResponse(turn, ctx.headers)
      : failureResponse('Turn not found', ctx.headers, 404);
  } catch (error) {
    return handleError(error, ctx.headers);
  }
}
