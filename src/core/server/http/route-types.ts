/**
 * Unified Route Types
 *
 * Core type definitions for the table-driven routing system.
 */

import type { z } from 'zod';
import type { Config } from '@/core/config/types.js';
import type { NativeSessionManager } from '@/core/server/session-manager.js';
import type { Result } from '@/utils/result.js';
import type { AnyDomainError } from '@/core/errors.js';

// === HTTP Methods ===

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

// === Route Context ===

/**
 * Context passed to all route handlers
 */
export interface RouteContext<TParams = unknown, TBody = unknown> {
  /** Validated request body (for POST/PUT/PATCH) */
  body: TBody;

  /** Validated query parameters */
  params: TParams;

  /** Path parameters extracted from URL (e.g., { name: 'my-session' }) */
  pathParams: Record<string, string>;

  /** Session manager for terminal operations */
  sessionManager: NativeSessionManager;

  /** Application configuration */
  config: Config;

  /** Unique request ID for logging and tracing */
  requestId: string;

  /** Original request (for headers, raw access) */
  req: Request;

  /** Whether Sentry is enabled */
  sentryEnabled: boolean;

  /** Base path for the application */
  basePath: string;
}

// === Route Handler ===

/**
 * Route handler function type
 *
 * Handlers receive validated input and return a Result.
 * The executor converts the Result to an HTTP Response.
 */
export type RouteHandler<TParams = unknown, TBody = unknown, TResult = unknown> = (
  ctx: RouteContext<TParams, TBody>
) => Promise<Result<TResult, AnyDomainError>> | Result<TResult, AnyDomainError>;

// === Route Definition ===

/**
 * Route definition for table-driven routing
 *
 * @example
 * const listSessions: RouteDef = {
 *   method: 'GET',
 *   path: '/api/sessions',
 *   handler: async (ctx) => ok(ctx.sessionManager.listSessions())
 * };
 *
 * @example
 * const createSession: RouteDef<unknown, CreateSessionBody> = {
 *   method: 'POST',
 *   path: '/api/sessions',
 *   bodySchema: CreateSessionBodySchema,
 *   handler: async (ctx) => {
 *     const { name, dir } = ctx.body;
 *     // ...
 *   }
 * };
 */
export interface RouteDef<TParams = unknown, TBody = unknown, TResult = unknown> {
  /** HTTP method */
  method: HttpMethod;

  /**
   * Path pattern
   *
   * Supports:
   * - Exact paths: '/api/sessions'
   * - Path parameters: '/api/sessions/:name'
   * - Wildcards: '/api/sessions/:name/*'
   */
  path: string;

  /** Request body schema (validated for POST/PUT/PATCH) */
  bodySchema?: z.ZodType<TBody>;

  /** Query parameter schema */
  querySchema?: z.ZodType<TParams>;

  /** Handler function */
  handler: RouteHandler<TParams, TBody, TResult>;

  /** Description for documentation */
  description?: string;

  /** Tags for grouping routes */
  tags?: string[];
}

// === Route Match Result ===

/**
 * Result of matching a request to a route
 */
export interface RouteMatch {
  /** Matched route definition */
  route: RouteDef;

  /** Extracted path parameters */
  pathParams: Record<string, string>;
}

// === Response Envelope ===

/**
 * Standard success response envelope
 */
export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  requestId: string;
}

/**
 * Standard error response envelope
 */
export interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
  };
  requestId: string;
}

/**
 * Union of success and error envelopes
 */
export type ResponseEnvelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

// === Route Dependencies ===

/**
 * Dependencies required by the route executor
 */
export interface RouteDeps {
  sessionManager: NativeSessionManager;
  config: Config;
  basePath: string;
  sentryEnabled: boolean;
}

// === Legacy Compatibility ===

/**
 * Legacy API context (for gradual migration)
 *
 * @deprecated Use RouteContext instead
 */
export interface LegacyApiContext {
  req: Request;
  config: Config;
  sessionManager: NativeSessionManager;
  basePath: string;
  apiPath: string;
  method: string;
  sentryEnabled: boolean;
}

/**
 * Convert legacy context to new context
 */
export function fromLegacyContext(
  legacy: LegacyApiContext,
  pathParams: Record<string, string> = {}
): Omit<RouteContext, 'body' | 'params'> {
  return {
    pathParams,
    sessionManager: legacy.sessionManager,
    config: legacy.config,
    requestId: generateRequestId(),
    req: legacy.req,
    sentryEnabled: legacy.sentryEnabled,
    basePath: legacy.basePath
  };
}

// === Utilities ===

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Check if a method can have a request body
 */
export function methodHasBody(method: string): boolean {
  return method === 'POST' || method === 'PUT' || method === 'PATCH';
}
