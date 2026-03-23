/**
 * Route Executor
 *
 * Executes route handlers with the full pipeline:
 * 1. Parse request body (if schema provided)
 * 2. Parse query params (if schema provided)
 * 3. Create context with requestId
 * 4. Call handler
 * 5. Convert Result to Response
 */

import type { ZodError } from 'zod';
import type { AnyDomainError } from '@/core/errors.js';
import { toHttpStatus, validationFailed } from '@/core/errors.js';
import { isErr, type Result } from '@/utils/result.js';
import {
  type ErrorEnvelope,
  generateRequestId,
  methodHasBody,
  type RouteContext,
  type RouteDef,
  type RouteDeps,
  type SuccessEnvelope
} from './route-types.js';
import { securityHeaders } from './utils.js';

// Re-export for convenience
export { generateRequestId } from './route-types.js';

// === Structured Logging ===

interface RouteLogEntry {
  requestId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  error?: string;
}

/**
 * Log a route request in structured format
 */
export function logRoute(entry: RouteLogEntry): void {
  const { requestId, method, path, status, durationMs, error } = entry;
  const statusEmoji = status >= 400 ? '❌' : '✓';
  const message = `[${requestId}] ${statusEmoji} ${method} ${path} ${status} ${durationMs}ms`;
  if (error) {
    console.error(message, { error });
  } else {
    console.log(message);
  }
}

// === Response Helpers ===

/**
 * Create a success response with envelope
 */
export function successResponse<T>(
  data: T,
  requestId: string,
  options: { status?: number; sentryEnabled?: boolean } = {}
): Response {
  const { status = 200, sentryEnabled = false } = options;
  const envelope: SuccessEnvelope<T> = {
    success: true,
    data,
    requestId
  };
  return new Response(JSON.stringify(envelope), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...securityHeaders(sentryEnabled)
    }
  });
}

/**
 * Create an error response with envelope
 */
export function errorEnvelopeResponse(
  error: AnyDomainError,
  requestId: string,
  sentryEnabled = false
): Response {
  const envelope: ErrorEnvelope = {
    success: false,
    error: {
      code: error.code,
      message: error.message
    },
    requestId
  };
  return new Response(JSON.stringify(envelope), {
    status: toHttpStatus(error),
    headers: {
      'Content-Type': 'application/json',
      ...securityHeaders(sentryEnabled)
    }
  });
}

/**
 * Create a validation error response from Zod error
 */
export function validationErrorResponse(
  zodError: ZodError,
  requestId: string,
  sentryEnabled = false
): Response {
  const firstIssue = zodError.issues[0];
  const field = firstIssue?.path.join('.') || 'unknown';
  const reason = firstIssue?.message || 'Invalid value';
  const error = validationFailed(field, reason);
  return errorEnvelopeResponse(error, requestId, sentryEnabled);
}

// === Route Execution ===

/**
 * Execute a route with the full pipeline
 */
export async function executeRoute<TParams, TBody, TResult>(
  route: RouteDef<TParams, TBody, TResult>,
  req: Request,
  pathParams: Record<string, string>,
  deps: RouteDeps
): Promise<Response> {
  const requestId = generateRequestId();

  try {
    // Parse body if schema provided and method has body
    let body: TBody = undefined as TBody;
    if (route.bodySchema && methodHasBody(req.method)) {
      const rawBody = await req.json().catch(() => ({}));
      const parsed = route.bodySchema.safeParse(rawBody);
      if (!parsed.success) {
        return validationErrorResponse(parsed.error, requestId, deps.sentryEnabled);
      }
      body = parsed.data;
    }

    // Parse query params if schema provided
    let params: TParams = undefined as TParams;
    if (route.querySchema) {
      const url = new URL(req.url);
      const rawParams = Object.fromEntries(url.searchParams);
      const parsed = route.querySchema.safeParse(rawParams);
      if (!parsed.success) {
        return validationErrorResponse(parsed.error, requestId, deps.sentryEnabled);
      }
      params = parsed.data;
    }

    // Create context
    const ctx: RouteContext<TParams, TBody> = {
      body,
      params,
      pathParams,
      sessionManager: deps.sessionManager,
      config: deps.config,
      requestId,
      req,
      sentryEnabled: deps.sentryEnabled,
      basePath: deps.basePath
    };

    // Execute handler
    const result = await route.handler(ctx);

    // Convert Result to Response
    return resultToResponse(result, requestId, deps.sentryEnabled);
  } catch (error) {
    // Unexpected error - log and return 500
    console.error(`[${requestId}] Unexpected error in route handler:`, error);
    const envelope: ErrorEnvelope = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      },
      requestId
    };
    return new Response(JSON.stringify(envelope), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...securityHeaders(deps.sentryEnabled)
      }
    });
  }
}

/**
 * Convert a Result to a Response
 */
export function resultToResponse<T>(
  result: Result<T, AnyDomainError>,
  requestId: string,
  sentryEnabled = false
): Response {
  if (isErr(result)) {
    return errorEnvelopeResponse(result.error, requestId, sentryEnabled);
  }
  return successResponse(result.value, requestId, { sentryEnabled });
}

// === Legacy Compatibility ===

/**
 * Execute a legacy handler that returns Response | null
 *
 * Used during migration period to wrap old-style handlers.
 */
export async function executeLegacyHandler(
  handler: (ctx: {
    req: Request;
    config: RouteDeps['config'];
    sessionManager: RouteDeps['sessionManager'];
    basePath: string;
    apiPath: string;
    method: string;
    sentryEnabled: boolean;
  }) => Promise<Response | null> | Response | null,
  req: Request,
  apiPath: string,
  deps: RouteDeps
): Promise<Response | null> {
  return handler({
    req,
    config: deps.config,
    sessionManager: deps.sessionManager,
    basePath: deps.basePath,
    apiPath,
    method: req.method,
    sentryEnabled: deps.sentryEnabled
  });
}
