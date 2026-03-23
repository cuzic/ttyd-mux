/**
 * Route Registry
 *
 * Manages route registration and matching for the HTTP server.
 */

import type { HttpMethod, RouteDef, RouteMatch } from './route-types.js';

// === Path Pattern Types ===

interface CompiledRoute {
  route: RouteDef;
  pattern: RegExp;
  paramNames: string[];
}

// === Route Registry ===

/**
 * Registry for managing route definitions
 */
export class RouteRegistry {
  private routes: Map<HttpMethod, CompiledRoute[]> = new Map();

  /**
   * Register a route
   */
  register(route: RouteDef): void {
    const { method } = route;
    const compiled = compileRoute(route);

    if (!this.routes.has(method)) {
      this.routes.set(method, []);
    }

    this.routes.get(method)!.push(compiled);
  }

  /**
   * Register multiple routes
   */
  registerAll(routes: RouteDef[]): void {
    for (const route of routes) {
      this.register(route);
    }
  }

  /**
   * Find a matching route for the given method and path
   */
  match(method: string, path: string): RouteMatch | null {
    const routes = this.routes.get(method as HttpMethod);
    if (!routes) {
      return null;
    }

    for (const compiled of routes) {
      const match = path.match(compiled.pattern);
      if (match) {
        const pathParams: Record<string, string> = {};
        for (let i = 0; i < compiled.paramNames.length; i++) {
          const name = compiled.paramNames[i];
          if (name) {
            pathParams[name] = decodeURIComponent(match[i + 1] || '');
          }
        }
        return { route: compiled.route, pathParams };
      }
    }

    return null;
  }

  /**
   * Check if any route exists for the given path (any method)
   * Used for 405 responses
   */
  hasPath(path: string): HttpMethod[] {
    const methods: HttpMethod[] = [];

    for (const [method, routes] of this.routes) {
      for (const compiled of routes) {
        if (compiled.pattern.test(path)) {
          methods.push(method);
          break;
        }
      }
    }

    return methods;
  }

  /**
   * Get all registered routes
   */
  getAllRoutes(): RouteDef[] {
    const all: RouteDef[] = [];
    for (const routes of this.routes.values()) {
      for (const compiled of routes) {
        all.push(compiled.route);
      }
    }
    return all;
  }

  /**
   * Clear all routes
   */
  clear(): void {
    this.routes.clear();
  }
}

// === Path Compilation ===

/**
 * Compile a route path pattern into a regex
 *
 * Supports:
 * - Exact paths: '/api/sessions'
 * - Path parameters: '/api/sessions/:name'
 * - Wildcards: '/api/sessions/:name/*'
 */
function compileRoute(route: RouteDef): CompiledRoute {
  const paramNames: string[] = [];
  let pattern = route.path;

  // Escape special regex characters except : and *
  pattern = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

  // Replace :param with capture groups
  pattern = pattern.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_match, name) => {
    paramNames.push(name);
    return '([^/]+)';
  });

  // Replace * with wildcard capture
  pattern = pattern.replace(/\*/g, '(.*)');

  // Anchor the pattern
  pattern = `^${pattern}$`;

  return {
    route,
    pattern: new RegExp(pattern),
    paramNames
  };
}

// === Global Registry ===

/**
 * Global route registry instance
 */
export const globalRegistry = new RouteRegistry();

/**
 * Register routes with the global registry
 */
export function registerRoutes(routes: RouteDef[]): void {
  globalRegistry.registerAll(routes);
}

/**
 * Match a route in the global registry
 */
export function matchRoute(method: string, path: string): RouteMatch | null {
  return globalRegistry.match(method, path);
}
