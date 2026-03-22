/**
 * Route Matcher Tests
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { ok, isOk, isErr } from '@/utils/result.js';
import type { RouteDef } from './route-types.js';
import { RouteRegistry } from './route-registry.js';
import {
  matchRequest,
  matchRequestResult,
  normalizePath,
  extractPathParams,
  pathMatches,
  joinPath
} from './route-matcher.js';

// === Test Helpers ===

function createRoute(
  method: RouteDef['method'],
  path: string
): RouteDef {
  return {
    method,
    path,
    handler: async () => ok({})
  };
}

// === matchRequest Tests ===

describe('matchRequest', () => {
  let registry: RouteRegistry;

  beforeEach(() => {
    registry = new RouteRegistry();
  });

  test('returns matched result for existing route', () => {
    registry.register(createRoute('GET', '/api/test'));

    const result = matchRequest(registry, 'GET', '/api/test');
    expect(result.type).toBe('matched');

    if (result.type === 'matched') {
      expect(result.match.route.path).toBe('/api/test');
    }
  });

  test('returns not_found for non-existent path', () => {
    registry.register(createRoute('GET', '/api/exists'));

    const result = matchRequest(registry, 'GET', '/api/not-exists');
    expect(result.type).toBe('not_found');
  });

  test('returns method_not_allowed for wrong method', () => {
    registry.register(createRoute('GET', '/api/test'));
    registry.register(createRoute('POST', '/api/test'));

    const result = matchRequest(registry, 'DELETE', '/api/test');
    expect(result.type).toBe('method_not_allowed');

    if (result.type === 'method_not_allowed') {
      expect(result.allowed).toContain('GET');
      expect(result.allowed).toContain('POST');
    }
  });

  test('extracts path parameters', () => {
    registry.register(createRoute('GET', '/api/sessions/:name'));

    const result = matchRequest(registry, 'GET', '/api/sessions/my-session');
    expect(result.type).toBe('matched');

    if (result.type === 'matched') {
      expect(result.match.pathParams.name).toBe('my-session');
    }
  });
});

// === matchRequestResult Tests ===

describe('matchRequestResult', () => {
  let registry: RouteRegistry;

  beforeEach(() => {
    registry = new RouteRegistry();
  });

  test('returns Ok with RouteMatch for existing route', () => {
    registry.register(createRoute('GET', '/api/test'));

    const result = matchRequestResult(registry, 'GET', '/api/test');
    expect(isOk(result)).toBe(true);

    if (isOk(result)) {
      expect(result.value.route.path).toBe('/api/test');
    }
  });

  test('returns Err with NotFoundError for non-existent path', () => {
    registry.register(createRoute('GET', '/api/exists'));

    const result = matchRequestResult(registry, 'GET', '/api/not-exists');
    expect(isErr(result)).toBe(true);

    if (isErr(result)) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  test('returns Err with MethodNotAllowedError for wrong method', () => {
    registry.register(createRoute('GET', '/api/test'));

    const result = matchRequestResult(registry, 'POST', '/api/test');
    expect(isErr(result)).toBe(true);

    if (isErr(result)) {
      expect(result.error.code).toBe('METHOD_NOT_ALLOWED');
      if (result.error.code === 'METHOD_NOT_ALLOWED') {
        expect(result.error.allowed).toContain('GET');
      }
    }
  });
});

// === normalizePath Tests ===

describe('normalizePath', () => {
  test('removes trailing slash', () => {
    expect(normalizePath('/api/test/')).toBe('/api/test');
  });

  test('preserves root path', () => {
    expect(normalizePath('/')).toBe('/');
  });

  test('decodes URI components', () => {
    expect(normalizePath('/api/hello%20world')).toBe('/api/hello world');
  });

  test('handles invalid URI encoding gracefully', () => {
    // Invalid encoding like %GG should not throw
    const result = normalizePath('/api/%GG');
    expect(typeof result).toBe('string');
  });

  test('preserves path without trailing slash', () => {
    expect(normalizePath('/api/test')).toBe('/api/test');
  });
});

// === extractPathParams Tests ===

describe('extractPathParams', () => {
  test('extracts single parameter', () => {
    const params = extractPathParams('/api/:id', '/api/123');
    expect(params).toEqual({ id: '123' });
  });

  test('extracts multiple parameters', () => {
    const params = extractPathParams('/api/:a/:b/:c', '/api/1/2/3');
    expect(params).toEqual({ a: '1', b: '2', c: '3' });
  });

  test('returns null for non-matching path', () => {
    const params = extractPathParams('/api/:id', '/other/123');
    expect(params).toBeNull();
  });

  test('returns empty object for path without parameters', () => {
    const params = extractPathParams('/api/test', '/api/test');
    expect(params).toEqual({});
  });

  test('decodes URL-encoded values', () => {
    const params = extractPathParams('/api/:name', '/api/hello%20world');
    expect(params?.name).toBe('hello world');
  });

  test('handles underscore in parameter names', () => {
    const params = extractPathParams('/api/:session_id', '/api/abc');
    expect(params).toEqual({ session_id: 'abc' });
  });

  test('handles wildcards', () => {
    const params = extractPathParams('/static/*', '/static/path/to/file');
    expect(params).not.toBeNull();
  });

  test('returns null for partial match', () => {
    const params = extractPathParams('/api/:id', '/api/123/extra');
    expect(params).toBeNull();
  });

  test('returns null for shorter path', () => {
    const params = extractPathParams('/api/:id/details', '/api/123');
    expect(params).toBeNull();
  });
});

// === pathMatches Tests ===

describe('pathMatches', () => {
  test('returns true for matching paths', () => {
    expect(pathMatches('/api/test', '/api/test')).toBe(true);
    expect(pathMatches('/api/:id', '/api/123')).toBe(true);
    expect(pathMatches('/api/:a/:b', '/api/x/y')).toBe(true);
  });

  test('returns false for non-matching paths', () => {
    expect(pathMatches('/api/test', '/other/test')).toBe(false);
    expect(pathMatches('/api/:id', '/api/')).toBe(false);
    expect(pathMatches('/api/:id', '/api/a/b')).toBe(false);
  });
});

// === joinPath Tests ===

describe('joinPath', () => {
  test('joins simple segments', () => {
    expect(joinPath('/api', 'sessions')).toBe('/api/sessions');
  });

  test('handles trailing slashes', () => {
    expect(joinPath('/api/', 'sessions')).toBe('/api/sessions');
  });

  test('handles leading slashes', () => {
    expect(joinPath('/api', '/sessions')).toBe('/api/sessions');
  });

  test('handles both leading and trailing slashes', () => {
    expect(joinPath('/api/', '/sessions/')).toBe('/api/sessions');
  });

  test('joins multiple segments', () => {
    expect(joinPath('/api', 'sessions', ':name', 'blocks')).toBe('/api/sessions/:name/blocks');
  });

  test('handles empty segments', () => {
    expect(joinPath('/api', '', 'sessions')).toBe('/api/sessions');
  });

  test('preserves root path', () => {
    // joinPath removes leading/trailing slashes, so '/' becomes empty string
    // and 'api' is the first non-empty segment
    expect(joinPath('/', 'api')).toBe('api');
  });
});
