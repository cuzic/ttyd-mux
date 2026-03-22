/**
 * Claude Quotes Route Context and Locator
 *
 * This file defines:
 * - QuoteRouteContext: context passed to route handlers
 * - Locator/Workspace/ClaudeContext: types for input resolution
 * - parseLocator/resolveWorkspace/resolveClaudeContext: resolution functions
 *
 * Response helpers (successResponse, failureResponse, handleError) are in response.ts.
 */

import type { NativeSessionManager } from '@/core/server/session-manager.js';
import { type Result, err, ok } from '@/utils/result.js';

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
// Locator Resolution
// =============================================================================
//
// ## Validation Boundary
//
// Route parameters are validated in two steps:
// 1. parseSearchParams() - validates individual field types (count, hours, path, etc.)
// 2. parseLocator() - validates the locator discriminated union (session OR claudeSessionId+projectPath)
//
// Why two steps?
// - Schema validation (Zod) handles type/format of individual fields
// - Locator validation handles the "one of two modes" business rule
// - This keeps schemas simple and reusable
//
// ## Input Modes
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
 * Resolved workspace - the directory to operate on
 */
export interface Workspace {
  cwd: string;
}

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
 * Parse URL params into a Locator (discriminated union validation)
 *
 * This validates that at least one of the two input modes is present:
 * - bunterm mode: session parameter
 * - Claude mode: claudeSessionId + projectPath parameters
 *
 * Use AFTER parseSearchParams() to validate individual field types.
 *
 * @example
 * // Step 1: Validate field types
 * const parsed = parseSearchParams(ctx.params, RecentParamsSchema);
 * if (!parsed.ok) return failureResponse(parsed.error, ctx.headers, 400);
 *
 * // Step 2: Validate locator (one of two modes required)
 * const locator = parseLocator(ctx.params);
 * if (!locator.ok) return failureResponse(locator.error.error, ctx.headers, locator.error.status);
 */
export function parseLocator(params: URLSearchParams): Result<Locator, RouteError> {
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

/**
 * Resolve workspace from locator
 *
 * Use for routes that only need file system access (git-diff, markdown, file-content).
 *
 * @example
 * const locator = parseLocator(ctx.params);
 * if (!locator.ok) return failureResponse(locator.error.error, ctx.headers, locator.error.status);
 * const workspace = resolveWorkspace(locator.value, ctx.sessionManager);
 * if (!workspace.ok) return failureResponse(workspace.error.error, ctx.headers, workspace.error.status);
 * // Use workspace.value.cwd
 */
export function resolveWorkspace(
  locator: Locator,
  sessionManager: NativeSessionManager
): Result<Workspace, RouteError> {
  if (locator.kind === 'claude') {
    return ok({ cwd: locator.projectPath });
  }

  // bunterm mode - lookup session
  const session = sessionManager.getSession(locator.sessionName);
  if (!session) {
    return err({ error: 'Session not found', status: 404 });
  }
  return ok({ cwd: session.cwd });
}

/**
 * Resolve Claude context from locator
 *
 * Use for routes that need Claude conversation history (recent, turn).
 * Returns ClaudeContext with optional claudeSessionId.
 *
 * When claudeSessionId is present (claude locator):
 *   Use getRecentClaudeTurnsFromSession / getClaudeTurnByUuidFromSession
 *
 * When claudeSessionId is null (bunterm locator):
 *   Use getRecentClaudeTurns / getClaudeTurnByUuid (queries most recent session)
 *
 * @example
 * const locator = parseLocator(ctx.params);
 * if (!locator.ok) return failureResponse(locator.error.error, ctx.headers, locator.error.status);
 * const claude = resolveClaudeContext(locator.value, ctx.sessionManager);
 * if (!claude.ok) return failureResponse(claude.error.error, ctx.headers, claude.error.status);
 *
 * // Choose method based on claudeSessionId presence
 * const turns = claude.value.claudeSessionId
 *   ? await getRecentClaudeTurnsFromSession(claude.value.cwd, claude.value.claudeSessionId, count)
 *   : await getRecentClaudeTurns(claude.value.cwd, count);
 */
export function resolveClaudeContext(
  locator: Locator,
  sessionManager: NativeSessionManager
): Result<ClaudeContext, RouteError> {
  if (locator.kind === 'claude') {
    return ok({
      cwd: locator.projectPath,
      claudeSessionId: locator.claudeSessionId
    });
  }

  // bunterm mode - lookup session for cwd
  const session = sessionManager.getSession(locator.sessionName);
  if (!session) {
    return err({ error: 'Session not found', status: 404 });
  }

  // Return with null claudeSessionId - caller uses project-level queries
  return ok({
    cwd: session.cwd,
    claudeSessionId: null
  });
}
