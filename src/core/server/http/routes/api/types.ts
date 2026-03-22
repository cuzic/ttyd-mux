/**
 * API Route Types
 *
 * Shared types for API route handlers.
 */

import type { Config } from '@/core/config/types.js';
import type { NativeSessionManager } from '@/core/server/session-manager.js';

/**
 * Context passed to all API route handlers
 */
export interface ApiContext {
  req: Request;
  config: Config;
  sessionManager: NativeSessionManager;
  basePath: string;
  apiPath: string;
  method: string;
  sentryEnabled: boolean;
}

/**
 * API route handler type
 * Returns Response if handled, null if not matched
 */
export type ApiRouteHandler = (ctx: ApiContext) => Promise<Response | null> | Response | null;
