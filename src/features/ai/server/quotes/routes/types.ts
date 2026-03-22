/**
 * Claude Quotes Route Types
 *
 * Shared types and helpers for quotes API routes.
 */

import type { NativeSessionManager } from '@/core/server/session-manager.js';
import {
  successResponse,
  failureResponse,
  handleError,
  type SessionResult
} from './response.js';

// Re-export response helpers for convenience
export { successResponse, failureResponse, handleError, type SessionResult };

/**
 * Context passed to quote route handlers
 */
export interface QuoteRouteContext {
  params: URLSearchParams;
  headers: Record<string, string>;
  sessionManager: NativeSessionManager;
}

/**
 * @deprecated Use successResponse instead
 */
export const jsonResponse = successResponse;

/**
 * @deprecated Use failureResponse instead
 */
export const errorResponse = failureResponse;

/**
 * Resolve session from context
 * Returns discriminated union with ok field for type-safe handling
 */
export function resolveSession(ctx: QuoteRouteContext): SessionResult {
  const sessionName = ctx.params.get('session');
  if (!sessionName) {
    return { ok: false, error: 'session parameter required', status: 400 };
  }

  const session = ctx.sessionManager.getSession(sessionName);
  if (!session) {
    return { ok: false, error: 'Session not found', status: 404 };
  }

  return { ok: true, cwd: session.cwd };
}
