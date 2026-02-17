// Type definitions for Caddy config
export interface CaddyConfig {
  apps?: {
    http?: {
      servers?: Record<string, CaddyServer>;
    };
  };
}

export interface CaddyServer {
  listen?: string[];
  routes?: CaddyRoute[];
}

export interface CaddyRoute {
  match?: CaddyMatch[];
  handle?: CaddyHandler[];
}

export interface CaddyMatch {
  host?: string[];
  path?: string[];
}

export interface CaddyHandler {
  handler: string;
  upstreams?: Array<{ dial: string }>;
  body?: string;
}

export const DEFAULT_ADMIN_API = 'http://localhost:2019';

/**
 * Client for Caddy Admin API
 */
export class CaddyClient {
  constructor(private adminApi: string = DEFAULT_ADMIN_API) {}

  /**
   * Get current Caddy configuration
   */
  async getConfig(): Promise<CaddyConfig> {
    const response = await fetch(`${this.adminApi}/config/`);
    if (!response.ok) {
      throw new Error(`Failed to get config: ${response.status}`);
    }
    return (await response.json()) as CaddyConfig;
  }

  /**
   * Get all HTTP servers
   */
  async getServers(): Promise<Record<string, CaddyServer>> {
    const config = await this.getConfig();
    return config.apps?.http?.servers ?? {};
  }

  /**
   * Update routes for a server
   */
  async updateServerRoutes(serverName: string, routes: CaddyRoute[]): Promise<void> {
    const response = await fetch(`${this.adminApi}/config/apps/http/servers/${serverName}/routes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(routes)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to update routes: ${response.status} ${text}`);
    }
  }

  /**
   * Create a new server
   */
  async createServer(serverName: string, server: CaddyServer): Promise<void> {
    const response = await fetch(`${this.adminApi}/config/apps/http/servers/${serverName}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(server)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to create server: ${response.status} ${text}`);
    }
  }

  /**
   * Find server that handles a specific hostname
   */
  findServerForHost(
    servers: Record<string, CaddyServer>,
    hostname: string
  ): { name: string; server: CaddyServer } | null {
    for (const [name, server] of Object.entries(servers)) {
      const routes = server.routes ?? [];
      for (const route of routes) {
        const matches = route.match ?? [];
        for (const match of matches) {
          if (match.host?.includes(hostname)) {
            return { name, server };
          }
        }
      }
    }
    return null;
  }

  /**
   * Check if a route exists for hostname and path
   */
  routeExists(server: CaddyServer, hostname: string, basePath: string): boolean {
    const routes = server.routes ?? [];
    return routes.some((route) => {
      const matches = route.match ?? [];
      return matches.some(
        (m) => m.host?.includes(hostname) && m.path?.some((p) => p.startsWith(basePath))
      );
    });
  }

  /**
   * Create a reverse proxy route
   */
  createProxyRoute(hostname: string, basePath: string, upstream: string): CaddyRoute {
    return {
      match: [
        {
          host: [hostname],
          path: [`${basePath}/*`]
        }
      ],
      handle: [
        {
          handler: 'reverse_proxy',
          upstreams: [{ dial: upstream }]
        }
      ]
    };
  }

  /**
   * Create a route for a specific session (static mode)
   */
  createSessionRoute(hostname: string, sessionPath: string, port: number): CaddyRoute {
    return {
      match: [
        {
          host: [hostname],
          path: [`${sessionPath}/*`]
        }
      ],
      handle: [
        {
          handler: 'reverse_proxy',
          upstreams: [{ dial: `localhost:${port}` }]
        }
      ]
    };
  }

  /**
   * Create portal route (exact match for base path without trailing content)
   */
  createPortalRoute(hostname: string, basePath: string, daemonPort: number): CaddyRoute {
    return {
      match: [
        {
          host: [hostname],
          path: [`${basePath}`, `${basePath}/`, `${basePath}/api/*`]
        }
      ],
      handle: [
        {
          handler: 'reverse_proxy',
          upstreams: [{ dial: `localhost:${daemonPort}` }]
        }
      ]
    };
  }

  /**
   * Check if a session route exists
   */
  sessionRouteExists(server: CaddyServer, hostname: string, sessionPath: string): boolean {
    const routes = server.routes ?? [];
    return routes.some((route) => {
      const matches = route.match ?? [];
      return matches.some(
        (m) => m.host?.includes(hostname) && m.path?.some((p) => p === `${sessionPath}/*`)
      );
    });
  }

  /**
   * Get all ttyd-mux session routes from a server
   */
  getSessionRoutes(
    server: CaddyServer,
    hostname: string,
    basePath: string
  ): Array<{ path: string; port: number }> {
    const results: Array<{ path: string; port: number }> = [];
    const routes = server.routes ?? [];

    for (const route of routes) {
      const matches = route.match ?? [];
      for (const match of matches) {
        if (!match.host?.includes(hostname)) continue;

        for (const path of match.path ?? []) {
          // Match session paths like /ttyd-mux/session-name/*
          if (path.startsWith(`${basePath}/`) && path.endsWith('/*')) {
            const sessionPath = path.slice(0, -2); // Remove /*
            const upstream = this.extractUpstream(route);
            const portMatch = upstream.match(/:(\d+)$/);
            if (portMatch?.[1]) {
              results.push({ path: sessionPath, port: Number.parseInt(portMatch[1], 10) });
            }
          }
        }
      }
    }

    return results;
  }

  /**
   * Remove session routes that are no longer active
   */
  filterOutSessionRoutes(
    routes: CaddyRoute[],
    hostname: string,
    basePath: string,
    keepPaths: Set<string>
  ): CaddyRoute[] {
    return routes.filter((route) => {
      const matches = route.match ?? [];
      for (const match of matches) {
        if (!match.host?.includes(hostname)) continue;

        for (const path of match.path ?? []) {
          // Check if this is a session route
          if (path.startsWith(`${basePath}/`) && path.endsWith('/*')) {
            const sessionPath = path.slice(0, -2);
            // Keep only if in keepPaths
            if (!keepPaths.has(sessionPath)) {
              return false;
            }
          }
        }
      }
      return true;
    });
  }

  /**
   * Extract upstream from route handlers
   */
  private extractUpstream(route: CaddyRoute): string {
    const handlers = route.handle ?? [];
    const proxyHandler = handlers.find((h) => h.handler === 'reverse_proxy');
    return proxyHandler?.upstreams?.[0]?.dial ?? 'unknown';
  }

  /**
   * Find ttyd-mux routes in all servers
   */
  findTtydMuxRoutes(
    servers: Record<string, CaddyServer>,
    basePath: string
  ): Array<{
    serverName: string;
    hosts: string[];
    paths: string[];
    upstream: string;
  }> {
    const results: Array<{
      serverName: string;
      hosts: string[];
      paths: string[];
      upstream: string;
    }> = [];

    for (const [serverName, server] of Object.entries(servers)) {
      for (const route of server.routes ?? []) {
        for (const match of route.match ?? []) {
          const paths = match.path ?? [];
          if (paths.some((p) => p.startsWith(basePath))) {
            const hosts = match.host ?? ['*'];
            const upstream = this.extractUpstream(route);
            results.push({ serverName, hosts, paths, upstream });
          }
        }
      }
    }

    return results;
  }
}

/**
 * Connect to Caddy Admin API and return client
 * Throws error if connection fails
 */
export async function connectToCaddy(adminApi: string = DEFAULT_ADMIN_API): Promise<CaddyClient> {
  const client = new CaddyClient(adminApi);
  // Test connection by getting config
  try {
    await client.getConfig();
  } catch {
    throw new Error(`Cannot connect to Caddy Admin API at ${adminApi}`);
  }
  return client;
}
