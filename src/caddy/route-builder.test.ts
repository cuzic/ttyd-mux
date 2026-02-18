import { describe, expect, test } from 'bun:test';
import type { CaddyServer } from './types.js';
import {
  createPortalRoute,
  createProxyRoute,
  createSessionRoute,
  filterOutSessionRoutes,
  findServerForHost,
  findTtydMuxRoutes,
  getSessionRoutes,
  routeExists,
  sessionRouteExists
} from './route-builder.js';

describe('route-builder', () => {
  describe('createProxyRoute', () => {
    test('creates a reverse proxy route', () => {
      const route = createProxyRoute('example.com', '/ttyd-mux', 'localhost:7680');

      expect(route.match).toEqual([
        { host: ['example.com'], path: ['/ttyd-mux/*'] }
      ]);
      expect(route.handle).toEqual([
        { handler: 'reverse_proxy', upstreams: [{ dial: 'localhost:7680' }] }
      ]);
    });
  });

  describe('createSessionRoute', () => {
    test('creates a session route', () => {
      const route = createSessionRoute('example.com', '/ttyd-mux/my-session', 7601);

      expect(route.match).toEqual([
        { host: ['example.com'], path: ['/ttyd-mux/my-session/*'] }
      ]);
      expect(route.handle).toEqual([
        { handler: 'reverse_proxy', upstreams: [{ dial: 'localhost:7601' }] }
      ]);
    });
  });

  describe('createPortalRoute', () => {
    test('creates a portal route', () => {
      const route = createPortalRoute('example.com', '/ttyd-mux', 7680);

      expect(route.match).toEqual([
        {
          host: ['example.com'],
          path: ['/ttyd-mux', '/ttyd-mux/', '/ttyd-mux/api/*']
        }
      ]);
      expect(route.handle).toEqual([
        { handler: 'reverse_proxy', upstreams: [{ dial: 'localhost:7680' }] }
      ]);
    });
  });

  describe('findServerForHost', () => {
    test('finds server by hostname', () => {
      const servers = {
        srv1: {
          routes: [
            { match: [{ host: ['other.com'], path: ['/*'] }] }
          ]
        },
        srv2: {
          routes: [
            { match: [{ host: ['example.com'], path: ['/ttyd-mux/*'] }] }
          ]
        }
      };

      const result = findServerForHost(servers, 'example.com');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('srv2');
    });

    test('returns null when no server matches', () => {
      const servers = {
        srv1: {
          routes: [
            { match: [{ host: ['other.com'], path: ['/*'] }] }
          ]
        }
      };

      const result = findServerForHost(servers, 'example.com');

      expect(result).toBeNull();
    });

    test('returns null for empty servers', () => {
      const result = findServerForHost({}, 'example.com');

      expect(result).toBeNull();
    });
  });

  describe('routeExists', () => {
    test('returns true when route exists', () => {
      const server: CaddyServer = {
        routes: [
          { match: [{ host: ['example.com'], path: ['/ttyd-mux/*'] }] }
        ]
      };

      expect(routeExists(server, 'example.com', '/ttyd-mux')).toBe(true);
    });

    test('returns false when route does not exist', () => {
      const server: CaddyServer = {
        routes: [
          { match: [{ host: ['example.com'], path: ['/other/*'] }] }
        ]
      };

      expect(routeExists(server, 'example.com', '/ttyd-mux')).toBe(false);
    });

    test('returns false for empty routes', () => {
      const server: CaddyServer = { routes: [] };

      expect(routeExists(server, 'example.com', '/ttyd-mux')).toBe(false);
    });
  });

  describe('sessionRouteExists', () => {
    test('returns true when session route exists', () => {
      const server: CaddyServer = {
        routes: [
          { match: [{ host: ['example.com'], path: ['/ttyd-mux/my-session/*'] }] }
        ]
      };

      expect(sessionRouteExists(server, 'example.com', '/ttyd-mux/my-session')).toBe(true);
    });

    test('returns false when session route does not exist', () => {
      const server: CaddyServer = {
        routes: [
          { match: [{ host: ['example.com'], path: ['/ttyd-mux/*'] }] }
        ]
      };

      expect(sessionRouteExists(server, 'example.com', '/ttyd-mux/my-session')).toBe(false);
    });
  });

  describe('getSessionRoutes', () => {
    test('extracts session routes from server', () => {
      const server: CaddyServer = {
        routes: [
          {
            match: [{ host: ['example.com'], path: ['/ttyd-mux/session1/*'] }],
            handle: [{ handler: 'reverse_proxy', upstreams: [{ dial: 'localhost:7601' }] }]
          },
          {
            match: [{ host: ['example.com'], path: ['/ttyd-mux/session2/*'] }],
            handle: [{ handler: 'reverse_proxy', upstreams: [{ dial: 'localhost:7602' }] }]
          },
          {
            match: [{ host: ['example.com'], path: ['/ttyd-mux', '/ttyd-mux/'] }],
            handle: [{ handler: 'reverse_proxy', upstreams: [{ dial: 'localhost:7680' }] }]
          }
        ]
      };

      const result = getSessionRoutes(server, 'example.com', '/ttyd-mux');

      expect(result).toHaveLength(2);
      expect(result).toContainEqual({ path: '/ttyd-mux/session1', port: 7601 });
      expect(result).toContainEqual({ path: '/ttyd-mux/session2', port: 7602 });
    });

    test('returns empty array for server without session routes', () => {
      const server: CaddyServer = {
        routes: [
          {
            match: [{ host: ['example.com'], path: ['/ttyd-mux'] }],
            handle: [{ handler: 'reverse_proxy', upstreams: [{ dial: 'localhost:7680' }] }]
          }
        ]
      };

      const result = getSessionRoutes(server, 'example.com', '/ttyd-mux');

      expect(result).toHaveLength(0);
    });
  });

  describe('filterOutSessionRoutes', () => {
    test('filters out stale session routes', () => {
      const routes = [
        {
          match: [{ host: ['example.com'], path: ['/ttyd-mux/keep/*'] }],
          handle: [{ handler: 'reverse_proxy', upstreams: [{ dial: 'localhost:7601' }] }]
        },
        {
          match: [{ host: ['example.com'], path: ['/ttyd-mux/remove/*'] }],
          handle: [{ handler: 'reverse_proxy', upstreams: [{ dial: 'localhost:7602' }] }]
        },
        {
          match: [{ host: ['example.com'], path: ['/other/*'] }],
          handle: [{ handler: 'reverse_proxy', upstreams: [{ dial: 'localhost:8080' }] }]
        }
      ];

      const keepPaths = new Set(['/ttyd-mux/keep']);
      const result = filterOutSessionRoutes(routes, 'example.com', '/ttyd-mux', keepPaths);

      expect(result).toHaveLength(2);
      expect(result.some((r) => r.match?.[0]?.path?.includes('/ttyd-mux/keep/*'))).toBe(true);
      expect(result.some((r) => r.match?.[0]?.path?.includes('/other/*'))).toBe(true);
      expect(result.some((r) => r.match?.[0]?.path?.includes('/ttyd-mux/remove/*'))).toBe(false);
    });
  });

  describe('findTtydMuxRoutes', () => {
    test('finds ttyd-mux routes across all servers', () => {
      const servers = {
        srv1: {
          routes: [
            {
              match: [{ host: ['example.com'], path: ['/ttyd-mux/*'] }],
              handle: [{ handler: 'reverse_proxy', upstreams: [{ dial: 'localhost:7680' }] }]
            }
          ]
        },
        srv2: {
          routes: [
            {
              match: [{ host: ['other.com'], path: ['/api/*'] }],
              handle: [{ handler: 'reverse_proxy', upstreams: [{ dial: 'localhost:8080' }] }]
            }
          ]
        }
      };

      const result = findTtydMuxRoutes(servers, '/ttyd-mux');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        serverName: 'srv1',
        hosts: ['example.com'],
        paths: ['/ttyd-mux/*'],
        upstream: 'localhost:7680'
      });
    });

    test('returns empty array when no ttyd-mux routes exist', () => {
      const servers = {
        srv1: {
          routes: [
            {
              match: [{ host: ['example.com'], path: ['/api/*'] }],
              handle: [{ handler: 'reverse_proxy', upstreams: [{ dial: 'localhost:8080' }] }]
            }
          ]
        }
      };

      const result = findTtydMuxRoutes(servers, '/ttyd-mux');

      expect(result).toHaveLength(0);
    });
  });
});
