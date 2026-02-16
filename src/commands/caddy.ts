import {
  type CaddyClient,
  type CaddyServer,
  DEFAULT_ADMIN_API,
  connectToCaddy
} from '../caddy/client.js';
import { loadConfig } from '../config/config.js';
import { handleCliError } from '../utils/errors.js';

export interface CaddyOptions {
  hostname?: string;
  adminApi?: string;
  config?: string;
}

// Generate snippet for Caddyfile users
export function caddySnippetCommand(options: CaddyOptions): void {
  const config = loadConfig(options.config);
  const basePath = config.base_path;
  const daemonPort = config.daemon_port;

  console.log('# Add this to your Caddyfile inside your site block:');
  console.log('');
  console.log(`handle ${basePath}/* {`);
  console.log(`    reverse_proxy localhost:${daemonPort}`);
  console.log('}');
}

// Setup route via Admin API
export async function caddySetupCommand(options: CaddyOptions): Promise<void> {
  const config = loadConfig(options.config);
  const adminApi = options.adminApi ?? DEFAULT_ADMIN_API;
  const hostname = options.hostname;

  if (!hostname) {
    console.error('Error: --hostname is required');
    process.exit(1);
  }

  const basePath = config.base_path;
  const daemonPort = config.daemon_port;

  let client: CaddyClient;
  try {
    client = await connectToCaddy(adminApi);
  } catch {
    console.error(`Error: Cannot connect to Caddy Admin API at ${adminApi}`);
    console.error('Make sure Caddy is running and admin API is enabled.');
    process.exit(1);
  }

  try {
    const servers = await client.getServers();
    const ttydMuxRoute = client.createProxyRoute(hostname, basePath, `localhost:${daemonPort}`);

    const serverInfo = client.findServerForHost(servers, hostname);

    if (serverInfo) {
      // Add route to existing server
      if (client.routeExists(serverInfo.server, hostname, basePath)) {
        console.log(`Route for ${hostname}${basePath}/* already exists.`);
        return;
      }

      // Prepend route (higher priority)
      const existingRoutes = serverInfo.server.routes ?? [];
      await client.updateServerRoutes(serverInfo.name, [ttydMuxRoute, ...existingRoutes]);
      console.log(`Added route: ${hostname}${basePath}/* -> localhost:${daemonPort}`);
    } else {
      // Create new server with this route
      const newServer: CaddyServer = {
        listen: [':443'],
        routes: [
          ttydMuxRoute,
          {
            // Fallback route
            handle: [
              {
                handler: 'static_response',
                body: 'OK'
              }
            ]
          }
        ]
      };

      const serverName = `srv_${hostname.replace(/\./g, '_')}`;
      await client.createServer(serverName, newServer);
      console.log(
        `Created server for ${hostname} with route: ${basePath}/* -> localhost:${daemonPort}`
      );
    }
  } catch (error) {
    handleCliError('Error', error);
    process.exit(1);
  }
}

// Remove route via Admin API
export async function caddyRemoveCommand(options: CaddyOptions): Promise<void> {
  const config = loadConfig(options.config);
  const adminApi = options.adminApi ?? DEFAULT_ADMIN_API;
  const hostname = options.hostname;

  if (!hostname) {
    console.error('Error: --hostname is required');
    process.exit(1);
  }

  const basePath = config.base_path;

  let client: CaddyClient;
  try {
    client = await connectToCaddy(adminApi);
  } catch {
    console.error(`Error: Cannot connect to Caddy Admin API at ${adminApi}`);
    process.exit(1);
  }

  try {
    const servers = await client.getServers();

    // Find and remove the route
    for (const [serverName, server] of Object.entries(servers)) {
      const routes = server.routes ?? [];
      const filteredRoutes = routes.filter((route) => {
        const matches = route.match ?? [];
        return !matches.some(
          (m) => m.host?.includes(hostname) && m.path?.some((p) => p.startsWith(basePath))
        );
      });

      if (filteredRoutes.length < routes.length) {
        await client.updateServerRoutes(serverName, filteredRoutes);
        console.log(`Removed route: ${hostname}${basePath}/*`);
        return;
      }
    }

    console.log(`Route for ${hostname}${basePath}/* not found.`);
  } catch (error) {
    handleCliError('Error', error);
    process.exit(1);
  }
}

// Show current Caddy status
export async function caddyStatusCommand(options: CaddyOptions): Promise<void> {
  const config = loadConfig(options.config);
  const adminApi = options.adminApi ?? DEFAULT_ADMIN_API;
  const basePath = config.base_path;

  let client: CaddyClient;
  try {
    client = await connectToCaddy(adminApi);
  } catch {
    console.error(`Error: Cannot connect to Caddy Admin API at ${adminApi}`);
    console.error('Make sure Caddy is running and admin API is enabled.');
    process.exit(1);
  }

  console.log(`Caddy Admin API: ${adminApi}`);
  console.log('');

  const servers = await client.getServers();

  if (Object.keys(servers).length === 0) {
    console.log('No HTTP servers configured.');
    return;
  }

  const routes = client.findTtydMuxRoutes(servers, basePath);

  if (routes.length === 0) {
    console.log(`No ttyd-mux routes found (looking for ${basePath}/*)`);
    return;
  }

  for (const route of routes) {
    console.log(`ttyd-mux route found in server "${route.serverName}":`);
    console.log(`  Hosts: ${route.hosts.join(', ')}`);
    console.log(`  Path: ${route.paths.join(', ')}`);
    console.log(`  Upstream: ${route.upstream}`);
    console.log('');
  }
}
