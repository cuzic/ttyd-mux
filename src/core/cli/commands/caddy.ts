import {
  type CaddyClient,
  type CaddyRoute,
  type CaddyServer,
  connectToCaddy
} from '@/caddy/client.js';
import {
  createProxyRoute,
  findServerForHost,
  findTtydMuxRoutes,
  routeExists
} from '@/caddy/route-builder.js';
import { loadConfig } from '@/core/config/config.js';
import type { Config } from '@/core/config/types.js';
import { CliError, requireHostname } from '@/utils/errors.js';

export interface CaddyOptions {
  hostname?: string;
  adminApi?: string;
  config?: string;
  caddySecurity?: boolean;
}

function getHostname(options: CaddyOptions, config: Config): string | undefined {
  return options.hostname ?? config.hostname;
}

function getAdminApi(options: CaddyOptions, config: Config): string {
  return options.adminApi ?? config.caddy_admin_api;
}

// Generate snippet for Caddyfile users
export function caddySnippetCommand(options: CaddyOptions): void {
  const config = loadConfig(options.config);
  const basePath = config.base_path;
  const daemonPort = config.daemon_port;
  const useCaddySecurity = options.caddySecurity ?? false;

  console.log('# Add this to your Caddyfile:');

  if (useCaddySecurity) {
    console.log('');
    console.log('# caddy-security: exclude WebSocket upgrades from the authorize check');
    console.log('@untrusted {');
    console.log('    not header Upgrade websocket');
    console.log('}');
    console.log('authorize with @untrusted');
  }

  console.log('');
  console.log('# WebSocket bypass – must come before any authorize directive');
  console.log('@ws_upgrade {');
  console.log('    header Connection *Upgrade*');
  console.log('    header Upgrade websocket');
  console.log('}');
  console.log('handle @ws_upgrade {');
  console.log(`    reverse_proxy 127.0.0.1:${daemonPort}`);
  console.log('}');

  console.log('');
  console.log(`handle_path ${basePath}/* {`);
  console.log(`  reverse_proxy localhost:${daemonPort}`);
  console.log('}');
}

// Setup route via Admin API
export async function caddySetupCommand(options: CaddyOptions): Promise<void> {
  const config = loadConfig(options.config);
  const adminApi = getAdminApi(options, config);
  const hostname = getHostname(options, config);
  requireHostname(hostname);

  const basePath = config.base_path;
  const daemonPort = config.daemon_port;

  const client = await connectToCaddyOrExit(adminApi);

  try {
    const servers = await client.getServers();
    const serverInfo = findServerForHost(servers, hostname);

    const buntermRoute = createProxyRoute(hostname, basePath, `localhost:${daemonPort}`);

    if (serverInfo) {
      if (routeExists(serverInfo.server, hostname, basePath)) {
        console.log(`Route already exists for ${hostname}${basePath}`);
        return;
      }

      const existingRoutes = serverInfo.server.routes ?? [];
      await client.updateServerRoutes(serverInfo.name, [buntermRoute, ...existingRoutes]);
      console.log(`Added route: ${hostname}${basePath} -> localhost:${daemonPort}`);
    } else {
      await createNewServer(client, hostname, [buntermRoute]);
      console.log(`Created server with route: ${hostname}${basePath} -> localhost:${daemonPort}`);
    }
  } catch (error) {
    throw CliError.from(error, 'Caddy setup failed');
  }
}

async function createNewServer(
  client: CaddyClient,
  hostname: string,
  routes: CaddyRoute[]
): Promise<void> {
  const newServer: CaddyServer = {
    listen: [':443'],
    routes: [
      ...routes,
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
}

// Remove route via Admin API
export async function caddyRemoveCommand(options: CaddyOptions): Promise<void> {
  const config = loadConfig(options.config);
  const adminApi = getAdminApi(options, config);
  const hostname = getHostname(options, config);
  requireHostname(hostname);

  const basePath = config.base_path;
  const client = await connectToCaddyOrExit(adminApi);

  try {
    const servers = await client.getServers();
    let removed = false;

    // Find and remove all bunterm routes
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
        removed = true;
      }
    }

    if (removed) {
      console.log(`Removed bunterm routes for ${hostname}${basePath}`);
    } else {
      console.log('No bunterm routes found to remove.');
    }
  } catch (error) {
    throw CliError.from(error, 'Caddy remove failed');
  }
}

async function connectToCaddyOrExit(adminApi: string): Promise<CaddyClient> {
  try {
    return await connectToCaddy(adminApi);
  } catch (error) {
    throw CliError.from(error, 'Failed to connect to Caddy Admin API');
  }
}

// Show current Caddy status
export async function caddyStatusCommand(options: CaddyOptions): Promise<void> {
  const config = loadConfig(options.config);
  const adminApi = getAdminApi(options, config);
  const basePath = config.base_path;
  const client = await connectToCaddyOrExit(adminApi);

  const servers = await client.getServers();

  if (Object.keys(servers).length === 0) {
    console.log('No Caddy servers configured.');
    return;
  }

  const routes = findTtydMuxRoutes(servers, basePath);

  if (routes.length === 0) {
    console.log(`No bunterm routes found for base path "${basePath}".`);
    console.log('Run "bunterm caddy setup" to configure Caddy routing.');
    return;
  }

  console.log('Bunterm routes in Caddy:');
  for (const route of routes) {
    const hostStr = route.hosts.length > 0 ? route.hosts.join(', ') : '*';
    const pathStr = route.paths.length > 0 ? route.paths.join(', ') : basePath;
    console.log(`  ${hostStr}${pathStr} -> ${route.upstream}`);
  }
}
