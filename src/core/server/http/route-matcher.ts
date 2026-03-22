/**
 * Route Matcher
 *
 * Utilities for matching request paths to routes.
 */

import {
  methodNotAllowed,
  notFound,
  type MethodNotAllowedError,
  type NotFoundError
} from '@/core/errors.js';
import { err, ok, type Result } from '@/utils/result.js';
import type { RouteMatch, HttpMethod } from './route-types.js';
import type { RouteRegistry } from './route-registry.js';

// === Match Result ===

export type MatchResult =
  | { type: 'matched'; match: RouteMatch }
  | { type: 'not_found' }
  | { type: 'method_not_allowed'; allowed: HttpMethod[] };

// === Matcher ===

/**
 * Match a request against the registry
 */
export function matchRequest(
  registry: RouteRegistry,
  method: string,
  path: string
): MatchResult {
  // Try exact method match
  const match = registry.match(method, path);
  if (match) {
    return { type: 'matched', match };
  }

  // Check if path exists with different method
  const allowedMethods = registry.hasPath(path);
  if (allowedMethods.length > 0) {
    return { type: 'method_not_allowed', allowed: allowedMethods };
  }

  // Not found
  return { type: 'not_found' };
}

/**
 * Match with Result return type
 */
export function matchRequestResult(
  registry: RouteRegistry,
  method: string,
  path: string
): Result<RouteMatch, MethodNotAllowedError | NotFoundError> {
  const result = matchRequest(registry, method, path);

  switch (result.type) {
    case 'matched':
      return ok(result.match);
    case 'method_not_allowed':
      return err(methodNotAllowed(method, result.allowed));
    case 'not_found':
      return err(notFound(path));
  }
}

// === Path Utilities ===

/**
 * Normalize a path (remove trailing slashes, decode)
 */
export function normalizePath(path: string): string {
  // Remove trailing slash (except for root)
  let normalized = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;

  // Decode URI components
  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    // Keep original if decode fails
  }

  return normalized;
}

/**
 * Extract path parameters from a pattern match
 */
export function extractPathParams(
  pattern: string,
  path: string
): Record<string, string> | null {
  const paramNames: string[] = [];
  let regexStr = pattern;

  // Replace :param with capture groups
  regexStr = regexStr.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_match, name) => {
    paramNames.push(name);
    return '([^/]+)';
  });

  // Replace * with wildcard capture
  regexStr = regexStr.replace(/\*/g, '(.*)');

  const regex = new RegExp(`^${regexStr}$`);
  const match = path.match(regex);

  if (!match) {
    return null;
  }

  const params: Record<string, string> = {};
  for (let i = 0; i < paramNames.length; i++) {
    const name = paramNames[i];
    if (name) {
      params[name] = decodeURIComponent(match[i + 1] || '');
    }
  }

  return params;
}

/**
 * Check if a path matches a pattern
 */
export function pathMatches(pattern: string, path: string): boolean {
  return extractPathParams(pattern, path) !== null;
}

/**
 * Join path segments
 */
export function joinPath(...segments: string[]): string {
  return segments
    .map((s, i) => {
      if (i === 0) {
        return s.endsWith('/') ? s.slice(0, -1) : s;
      }
      let cleaned = s.startsWith('/') ? s.slice(1) : s;
      cleaned = cleaned.endsWith('/') ? cleaned.slice(0, -1) : cleaned;
      return cleaned;
    })
    .filter(Boolean)
    .join('/');
}
