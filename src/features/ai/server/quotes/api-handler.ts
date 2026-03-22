/**
 * Claude Quotes API Handler
 *
 * Dispatches Claude Quotes API requests to specific route handlers.
 *
 * Routes:
 * - GET /api/claude-quotes/sessions - List recent Claude sessions
 * - GET /api/claude-quotes/recent - Get recent turns
 * - GET /api/claude-quotes/recent-markdown - Get recent markdown files
 * - GET /api/claude-quotes/turn/:uuid - Get full turn content
 * - GET /api/claude-quotes/project-markdown - Get project *.md files
 * - GET /api/claude-quotes/plans - Get plan files
 * - GET /api/claude-quotes/file-content - Get file content
 * - GET /api/claude-quotes/git-diff - Get git diff
 * - GET /api/claude-quotes/git-diff-file - Get single file diff
 */

import type { NativeSessionManager } from '@/core/server/session-manager.js';
import type { QuoteRouteContext } from './routes/types.js';
import { handleSessionsRoute } from './routes/sessions-route.js';
import { handleRecentRoute, handleRecentMarkdownRoute } from './routes/recent-route.js';
import { handleTurnRoute } from './routes/turn-route.js';
import { handleMarkdownRoute } from './routes/markdown-route.js';
import { handlePlansRoute } from './routes/plans-route.js';
import { handleFileContentRoute } from './routes/file-content-route.js';
import { handleGitDiffRoute, handleGitDiffFileRoute } from './routes/git-diff-route.js';

/**
 * Route definition for table-driven routing
 */
interface RouteDefinition {
  /** Exact path match (takes precedence over pattern and prefix) */
  exact?: string;
  /** Regex pattern for dynamic routes */
  pattern?: RegExp;
  /** Prefix match (used only if exact and pattern are not set) */
  prefix?: string;
  /** Handler function */
  handler: (ctx: QuoteRouteContext, match?: RegExpMatchArray) => Response | Promise<Response>;
}

/**
 * Route table for Claude Quotes API
 *
 * Routes are matched in order:
 * 1. Exact matches first
 * 2. Pattern (regex) matches
 * 3. Prefix matches (longer prefixes first)
 */
const ROUTE_TABLE: RouteDefinition[] = [
  // Exact matches
  {
    exact: '/claude-quotes/sessions',
    handler: handleSessionsRoute
  },
  // Pattern matches (dynamic routes)
  {
    pattern: /^\/claude-quotes\/turn\/([^/]+)$/,
    handler: (ctx, match) => {
      const uuid = decodeURIComponent(match![1]!);
      return handleTurnRoute(ctx, uuid);
    }
  },
  // Prefix matches (ordered by specificity - longer prefixes first)
  {
    prefix: '/claude-quotes/recent-markdown',
    handler: handleRecentMarkdownRoute
  },
  {
    prefix: '/claude-quotes/recent',
    handler: handleRecentRoute
  },
  {
    prefix: '/claude-quotes/project-markdown',
    handler: handleMarkdownRoute
  },
  {
    prefix: '/claude-quotes/plans',
    handler: handlePlansRoute
  },
  {
    prefix: '/claude-quotes/file-content',
    handler: handleFileContentRoute
  },
  {
    prefix: '/claude-quotes/git-diff-file',
    handler: handleGitDiffFileRoute
  },
  {
    prefix: '/claude-quotes/git-diff',
    handler: handleGitDiffRoute
  }
];

/**
 * Find matching route from route table
 */
function findRoute(
  apiPath: string
): { route: RouteDefinition; match?: RegExpMatchArray } | null {
  for (const route of ROUTE_TABLE) {
    // Exact match
    if (route.exact && apiPath === route.exact) {
      return { route };
    }
    // Pattern match
    if (route.pattern) {
      const match = apiPath.match(route.pattern);
      if (match) {
        return { route, match };
      }
    }
    // Prefix match
    if (route.prefix && apiPath.startsWith(route.prefix)) {
      return { route };
    }
  }
  return null;
}

/**
 * Handle Claude Quotes API request
 * @returns Response if handled, null if not a claude-quotes route
 */
export async function handleClaudeQuotesApi(
  req: Request,
  apiPath: string,
  method: string,
  headers: Record<string, string>,
  sessionManager: NativeSessionManager
): Promise<Response | null> {
  // Only handle GET requests to /claude-quotes/*
  if (method !== 'GET' || !apiPath.startsWith('/claude-quotes/')) {
    return null;
  }

  const found = findRoute(apiPath);
  if (!found) {
    return null;
  }

  const params = new URL(req.url).searchParams;
  const ctx: QuoteRouteContext = { params, headers, sessionManager };

  return found.route.handler(ctx, found.match);
}

// Export for testing
export { ROUTE_TABLE, findRoute };
