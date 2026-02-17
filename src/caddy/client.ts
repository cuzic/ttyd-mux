import type { CaddyConfig, CaddyRoute, CaddyServer } from './types.js';

// Types are re-exported for use by commands/caddy.ts
export type { CaddyConfig, CaddyRoute, CaddyServer } from './types.js';

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
