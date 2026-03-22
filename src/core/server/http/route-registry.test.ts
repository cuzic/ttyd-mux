/**
 * Route Registry Tests
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { ok } from '@/utils/result.js';
import type { RouteDef } from './route-types.js';
import { RouteRegistry, globalRegistry, registerRoutes, matchRoute } from './route-registry.js';

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

// === RouteRegistry Tests ===

describe('RouteRegistry', () => {
  let registry: RouteRegistry;

  beforeEach(() => {
    registry = new RouteRegistry();
  });

  describe('register', () => {
    test('registers a route', () => {
      const route = createRoute('GET', '/api/test');
      registry.register(route);

      const match = registry.match('GET', '/api/test');
      expect(match).not.toBeNull();
      expect(match?.route).toBe(route);
    });

    test('registers multiple routes for same method', () => {
      const route1 = createRoute('GET', '/api/a');
      const route2 = createRoute('GET', '/api/b');

      registry.register(route1);
      registry.register(route2);

      expect(registry.match('GET', '/api/a')?.route).toBe(route1);
      expect(registry.match('GET', '/api/b')?.route).toBe(route2);
    });

    test('registers routes for different methods', () => {
      const getRoute = createRoute('GET', '/api/items');
      const postRoute = createRoute('POST', '/api/items');

      registry.register(getRoute);
      registry.register(postRoute);

      expect(registry.match('GET', '/api/items')?.route).toBe(getRoute);
      expect(registry.match('POST', '/api/items')?.route).toBe(postRoute);
    });
  });

  describe('registerAll', () => {
    test('registers multiple routes at once', () => {
      const routes = [
        createRoute('GET', '/api/a'),
        createRoute('POST', '/api/b'),
        createRoute('DELETE', '/api/c')
      ];

      registry.registerAll(routes);

      expect(registry.match('GET', '/api/a')).not.toBeNull();
      expect(registry.match('POST', '/api/b')).not.toBeNull();
      expect(registry.match('DELETE', '/api/c')).not.toBeNull();
    });
  });

  describe('match', () => {
    test('returns null for unregistered path', () => {
      registry.register(createRoute('GET', '/api/exists'));

      const match = registry.match('GET', '/api/not-exists');
      expect(match).toBeNull();
    });

    test('returns null for unregistered method', () => {
      registry.register(createRoute('GET', '/api/test'));

      const match = registry.match('POST', '/api/test');
      expect(match).toBeNull();
    });

    test('extracts path parameters', () => {
      registry.register(createRoute('GET', '/api/sessions/:name'));

      const match = registry.match('GET', '/api/sessions/my-session');
      expect(match).not.toBeNull();
      expect(match?.pathParams.name).toBe('my-session');
    });

    test('extracts multiple path parameters', () => {
      registry.register(createRoute('GET', '/api/sessions/:session/blocks/:block'));

      const match = registry.match('GET', '/api/sessions/sess1/blocks/blk1');
      expect(match).not.toBeNull();
      expect(match?.pathParams.session).toBe('sess1');
      expect(match?.pathParams.block).toBe('blk1');
    });

    test('decodes URL-encoded path parameters', () => {
      registry.register(createRoute('GET', '/api/sessions/:name'));

      const match = registry.match('GET', '/api/sessions/my%20session');
      expect(match?.pathParams.name).toBe('my session');
    });

    test('matches wildcard patterns', () => {
      registry.register(createRoute('GET', '/api/files/*'));

      const match = registry.match('GET', '/api/files/path/to/file.txt');
      expect(match).not.toBeNull();
    });

    test('matches exact paths over parameterized paths', () => {
      const exactRoute = createRoute('GET', '/api/sessions/default');
      const paramRoute = createRoute('GET', '/api/sessions/:name');

      // Register exact route first
      registry.register(exactRoute);
      registry.register(paramRoute);

      // Exact match should take precedence (first registered wins)
      const match = registry.match('GET', '/api/sessions/default');
      expect(match?.route).toBe(exactRoute);
    });

    test('handles special characters in path', () => {
      registry.register(createRoute('GET', '/api/test.json'));

      const match = registry.match('GET', '/api/test.json');
      expect(match).not.toBeNull();
    });
  });

  describe('hasPath', () => {
    test('returns empty array for non-existent path', () => {
      registry.register(createRoute('GET', '/api/exists'));

      const methods = registry.hasPath('/api/not-exists');
      expect(methods).toEqual([]);
    });

    test('returns methods for existing path', () => {
      registry.register(createRoute('GET', '/api/items'));
      registry.register(createRoute('POST', '/api/items'));
      registry.register(createRoute('DELETE', '/api/items'));

      const methods = registry.hasPath('/api/items');
      expect(methods).toContain('GET');
      expect(methods).toContain('POST');
      expect(methods).toContain('DELETE');
      expect(methods.length).toBe(3);
    });

    test('works with parameterized paths', () => {
      registry.register(createRoute('GET', '/api/sessions/:name'));
      registry.register(createRoute('DELETE', '/api/sessions/:name'));

      const methods = registry.hasPath('/api/sessions/test');
      expect(methods).toContain('GET');
      expect(methods).toContain('DELETE');
    });
  });

  describe('getAllRoutes', () => {
    test('returns empty array for empty registry', () => {
      const routes = registry.getAllRoutes();
      expect(routes).toEqual([]);
    });

    test('returns all registered routes', () => {
      const route1 = createRoute('GET', '/api/a');
      const route2 = createRoute('POST', '/api/b');

      registry.register(route1);
      registry.register(route2);

      const routes = registry.getAllRoutes();
      expect(routes.length).toBe(2);
      expect(routes).toContain(route1);
      expect(routes).toContain(route2);
    });
  });

  describe('clear', () => {
    test('removes all routes', () => {
      registry.register(createRoute('GET', '/api/a'));
      registry.register(createRoute('POST', '/api/b'));

      registry.clear();

      expect(registry.match('GET', '/api/a')).toBeNull();
      expect(registry.match('POST', '/api/b')).toBeNull();
      expect(registry.getAllRoutes()).toEqual([]);
    });
  });
});

// === Path Pattern Compilation Tests ===

describe('Path Pattern Compilation', () => {
  let registry: RouteRegistry;

  beforeEach(() => {
    registry = new RouteRegistry();
  });

  test('compiles exact paths', () => {
    registry.register(createRoute('GET', '/api/sessions'));

    expect(registry.match('GET', '/api/sessions')).not.toBeNull();
    expect(registry.match('GET', '/api/sessions/')).toBeNull();
    expect(registry.match('GET', '/api/session')).toBeNull();
  });

  test('compiles single parameter paths', () => {
    registry.register(createRoute('GET', '/api/:id'));

    expect(registry.match('GET', '/api/123')?.pathParams.id).toBe('123');
    expect(registry.match('GET', '/api/abc')?.pathParams.id).toBe('abc');
    expect(registry.match('GET', '/api/')).toBeNull();
    expect(registry.match('GET', '/api')).toBeNull();
  });

  test('compiles paths with parameters in middle', () => {
    registry.register(createRoute('GET', '/api/:id/details'));

    const match = registry.match('GET', '/api/123/details');
    expect(match?.pathParams.id).toBe('123');
    expect(registry.match('GET', '/api/123')).toBeNull();
  });

  test('escapes regex special characters', () => {
    registry.register(createRoute('GET', '/api/file.json'));
    registry.register(createRoute('GET', '/api/v1+beta'));

    expect(registry.match('GET', '/api/file.json')).not.toBeNull();
    expect(registry.match('GET', '/api/v1+beta')).not.toBeNull();
    // Dot shouldn't match any character
    expect(registry.match('GET', '/api/fileXjson')).toBeNull();
  });

  test('compiles wildcard at end', () => {
    registry.register(createRoute('GET', '/static/*'));

    expect(registry.match('GET', '/static/file.js')).not.toBeNull();
    expect(registry.match('GET', '/static/path/to/file.js')).not.toBeNull();
    expect(registry.match('GET', '/static')).toBeNull();
  });
});

// === Global Registry Tests ===

describe('Global Registry Functions', () => {
  beforeEach(() => {
    globalRegistry.clear();
  });

  test('registerRoutes adds to global registry', () => {
    const routes = [
      createRoute('GET', '/global/a'),
      createRoute('POST', '/global/b')
    ];

    registerRoutes(routes);

    expect(matchRoute('GET', '/global/a')).not.toBeNull();
    expect(matchRoute('POST', '/global/b')).not.toBeNull();
  });

  test('matchRoute uses global registry', () => {
    registerRoutes([createRoute('GET', '/global/test')]);

    const match = matchRoute('GET', '/global/test');
    expect(match).not.toBeNull();
    expect(match?.pathParams).toEqual({});
  });
});
