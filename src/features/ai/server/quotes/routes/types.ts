/**
 * Claude Quotes Route Context and Locator
 *
 * This file defines:
 * - QuoteRouteContext: context passed to route handlers
 * - Locator/ClaudeContext: types for input resolution
 * - resolveWorkspaceFromParams/resolveClaudeFromParams: one-step resolution helpers
 *
 * Response helpers (successResponse, failureResponse, handleError) are in response.ts.
 */

import type { NativeSessionManager } from '@/core/server/session-manager.js';
import { type Result, err, ok } from '@/utils/result.js';
import { failureResponse } from './response.js';

/**
 * Context passed to quote route handlers
 *
 * ## Field Usage
 * - params: Used by ALL routes for parameter parsing
 * - headers: Used by ALL routes for response CORS headers
 * - sessionManager: Used by MOST routes (for bunterm session lookup)
 *   - Not used by: plans-route, sessions-route (these don't need bunterm session)
 *
 * ## Adding New Dependencies
 *
 * Before adding a new field, ask:
 * 1. Is it needed by most (>50%) routes? If yes, add to context.
 * 2. Is it needed by only 1-2 routes? Pass as function parameter instead.
 * 3. Can it be derived from existing fields? Don't add redundant data.
 *
 * Avoid making context a "god object" that holds everything.
 */
export interface QuoteRouteContext {
  params: URLSearchParams;
  headers: Record<string, string>;
  sessionManager: NativeSessionManager;
}

// =============================================================================
// Locator Types
// =============================================================================
//
// Routes accept two input modes:
// 1. bunterm session: session=<name> -> uses sessionManager to get cwd
// 2. Claude locator: claudeSessionId + projectPath -> uses projectPath as cwd

/**
 * HTTP input locator - identifies the request source
 */
export type Locator =
  | { kind: 'bunterm'; sessionName: string }
  | { kind: 'claude'; projectPath: string; claudeSessionId: string };

/**
 * Resolved Claude context - workspace + optional conversation reference
 *
 * When claudeSessionId is present, use session-specific queries.
 * When absent, use project-level queries (most recent session).
 */
export interface ClaudeContext {
  cwd: string;
  claudeSessionId: string | null;
}

/**
 * Route error with HTTP status
 */
export interface RouteError {
  error: string;
  status: 400 | 404;
}

/**
 * Parse URL params into a Locator (internal helper)
 *
 * Used internally by resolveWorkspaceFromParams/resolveClaudeFromParams.
 * Routes should use the one-step helpers instead of calling this directly.
 */
function parseLocator(params: URLSearchParams): Result<Locator, RouteError> {
  const sessionName = params.get('session');
  const claudeSessionId = params.get('claudeSessionId');
  const projectPath = params.get('projectPath');

  // Claude mode takes precedence
  if (claudeSessionId && projectPath) {
    return ok({ kind: 'claude', projectPath, claudeSessionId });
  }

  // Bunterm mode
  if (sessionName) {
    return ok({ kind: 'bunterm', sessionName });
  }

  return err({
    error: 'Either session or (claudeSessionId + projectPath) is required',
    status: 400
  });
}

// =============================================================================
// Resolution Helpers
// =============================================================================

/**
 * Resolve workspace (cwd) from request params.
 * Returns either the cwd string or a failure Response.
 */
export function resolveWorkspaceFromParams(ctx: QuoteRouteContext): string | Response {
  const locator = parseLocator(ctx.params);
  if (!locator.ok) {
    return failureResponse(locator.error.error, ctx.headers, locator.error.status);
  }

  if (locator.value.kind === 'claude') {
    return locator.value.projectPath;
  }

  // bunterm mode - lookup session
  const session = ctx.sessionManager.getSession(locator.value.sessionName);
  if (!session) {
    return failureResponse('Session not found', ctx.headers, 404);
  }
  return session.cwd;
}

/**
 * Resolve Claude context from request params.
 * Returns either ClaudeContext or a failure Response.
 */
export function resolveClaudeFromParams(ctx: QuoteRouteContext): ClaudeContext | Response {
  const locator = parseLocator(ctx.params);
  if (!locator.ok) {
    return failureResponse(locator.error.error, ctx.headers, locator.error.status);
  }

  if (locator.value.kind === 'claude') {
    return {
      cwd: locator.value.projectPath,
      claudeSessionId: locator.value.claudeSessionId
    };
  }

  // bunterm mode - lookup session
  const session = ctx.sessionManager.getSession(locator.value.sessionName);
  if (!session) {
    return failureResponse('Session not found', ctx.headers, 404);
  }

  return {
    cwd: session.cwd,
    claudeSessionId: null
  };
}
