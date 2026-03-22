/**
 * Auth API Routes
 *
 * Handles authentication: WebSocket token generation.
 */

import type { ApiContext } from './types.js';
import { jsonResponse, errorResponse } from '../../utils.js';

/**
 * Handle auth API routes
 */
export async function handleAuthRoutes(ctx: ApiContext): Promise<Response | null> {
  const { apiPath, method, req, sessionManager, sentryEnabled } = ctx;

  // POST /api/auth/ws-token
  if (apiPath === '/auth/ws-token' && method === 'POST') {
    try {
      const body = (await req.json()) as { sessionId: string; userId?: string };

      if (!body.sessionId || typeof body.sessionId !== 'string') {
        return errorResponse('sessionId is required', 400, sentryEnabled);
      }

      if (!sessionManager.hasSession(body.sessionId)) {
        return errorResponse(`Session "${body.sessionId}" not found`, 404, sentryEnabled);
      }

      const { getTokenGenerator } = await import('@/core/server/ws/session-token.js');
      const tokenGenerator = getTokenGenerator();
      const token = tokenGenerator.generate(body.sessionId, body.userId);

      return jsonResponse(
        {
          token,
          sessionId: body.sessionId,
          expiresIn: 30
        },
        { sentryEnabled }
      );
    } catch (error) {
      return errorResponse(String(error), 500, sentryEnabled);
    }
  }

  return null;
}
