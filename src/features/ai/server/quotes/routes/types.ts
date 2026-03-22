/**
 * Claude Quotes Route Types
 *
 * Shared types and helpers for quotes API routes.
 */

import type { NativeSessionManager } from '@/core/server/session-manager.js';

/**
 * Context passed to quote route handlers
 */
export interface QuoteRouteContext {
  params: URLSearchParams;
  headers: Record<string, string>;
  sessionManager: NativeSessionManager;
}

/** JSON response helper */
export const jsonResponse = (
  data: unknown,
  headers: Record<string, string>,
  status = 200
): Response => new Response(JSON.stringify(data), { status, headers });

/** Error response helper */
export const errorResponse = (
  error: string,
  headers: Record<string, string>,
  status = 400
): Response => new Response(JSON.stringify({ error }), { status, headers });

/**
 * Resolve session from context
 * Returns session cwd or null if not found
 */
export function resolveSession(
  ctx: QuoteRouteContext
): { cwd: string } | { error: string; status: number } {
  const sessionName = ctx.params.get('session');
  if (!sessionName) {
    return { error: 'session parameter required', status: 400 };
  }

  const session = ctx.sessionManager.getSession(sessionName);
  if (!session) {
    return { error: 'Session not found', status: 404 };
  }

  return { cwd: session.cwd };
}
