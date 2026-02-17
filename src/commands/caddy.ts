import {
  type CaddyClient,
  type CaddyRoute,
  type CaddyServer,
  connectToCaddy
} from '@/caddy/client.js';
import {
  createPortalRoute,
  createProxyRoute,
  createSessionRoute,
  filterOutSessionRoutes,
  findServerForHost,
  findTtydMuxRoutes,
  getSessionRoutes,
  routeExists
} from '@/caddy/route-builder.js';
import { getSessions, isDaemonRunning } from '@/client/index.js';
import { loadConfig } from '@/config/config.js';
import type { Config, SessionResponse } from '@/config/types.js';
import { handleCliError, requireHostname } from '@/utils/errors.js';

export interface CaddyOptions {
  hostname?: string;
  adminApi?: string;
  config?: string;
}

function getHostname(options: CaddyOptions, config: Config): string | undefined {
  return options.hostname ?? config.hostname;
}

function getAdminApi(options: CaddyOptions, config: Config): string {
  return options.adminApi ?? config.caddy_admin_api;
}

// Generate snippet for Caddyfile users
export async function caddySnippetCommand(options: CaddyOptions): Promise<void> {
  const config = loadConfig(options.config);
  const basePath = config.base_path;
  const daemonPort = config.daemon_port;
  const proxyMode = config.proxy_mode;

  console.log('# Add this to your Caddyfile inside your site block:');
  console.log('');

  if (proxyMode === 'proxy') {
    // Proxy mode: single route proxies all to daemon
    console.log(`handle ${basePath}/* {`);
    console.log(`    reverse_proxy localhost:${daemonPort}`);
    console.log('}');
  } else {
    // Static mode: portal/API to daemon, sessions direct to ttyd
    console.log('# Portal and API (via daemon)');
    console.log(`handle ${basePath} {`);
    console.log(`    reverse_proxy localhost:${daemonPort}`);
    console.log('}');
    console.log('');
    console.log(`handle ${basePath}/ {`);
    console.log(`    reverse_proxy localhost:${daemonPort}`);
    console.log('}');
    console.log('');
    console.log(`handle ${basePath}/api/* {`);
    console.log(`    reverse_proxy localhost:${daemonPort}`);
    console.log('}');

    // Get current sessions if daemon is running
    if (await isDaemonRunning()) {
      const sessions = await getSessions(config);
      if (sessions.length > 0) {
        console.log('');
        console.log('# Sessions (direct to ttyd)');
        for (const session of sessions) {
          console.log('');
          console.log(`# Session: ${session.name}`);
          console.log(`handle ${session.fullPath}/* {`);
          console.log(`    reverse_proxy localhost:${session.port}`);
          console.log('}');
        }
      }
    } else {
      console.log('');
      console.log(
        '# Note: Daemon is not running. Start sessions and re-run to see session routes.'
      );
    }
  }
}

// Setup route via Admin API
export async function caddySetupCommand(options: CaddyOptions): Promise<void> {
  const config = loadConfig(options.config);
  const adminApi = getAdminApi(options, config);
  const hostname = getHostname(options, config);
  requireHostname(hostname);

  const basePath = config.base_path;
  const daemonPort = config.daemon_port;
  const proxyMode = config.proxy_mode;

  const client = await connectToCaddyOrExit(adminApi);

  try {
    const servers = await client.getServers();
    const serverInfo = findServerForHost(servers, hostname);

    if (proxyMode === 'proxy') {
      // Proxy mode: single proxy route
      const ttydMuxRoute = createProxyRoute(hostname, basePath, `localhost:${daemonPort}`);

      if (serverInfo) {
        if (routeExists(serverInfo.server, hostname, basePath)) {
          console.log(`Route for ${hostname}${basePath}/* already exists.`);
          return;
        }

        const existingRoutes = serverInfo.server.routes ?? [];
        await client.updateServerRoutes(serverInfo.name, [ttydMuxRoute, ...existingRoutes]);
        console.log(`Added route: ${hostname}${basePath}/* -> localhost:${daemonPort}`);
      } else {
        await createNewServer(client, hostname, [ttydMuxRoute]);
        console.log(
          `Created server for ${hostname} with route: ${basePath}/* -> localhost:${daemonPort}`
        );
      }
    } else {
      // Static mode: portal route + session routes
      await setupStaticMode(client, config, hostname, basePath, daemonPort, serverInfo);
    }
  } catch (error) {
    handleCliError('Error', error);
    process.exit(1);
  }
}

async function setupStaticMode(
  client: CaddyClient,
  config: Config,
  hostname: string,
  basePath: string,
  daemonPort: number,
  serverInfo: { name: string; server: CaddyServer } | null
): Promise<void> {
  const routes: CaddyRoute[] = [];

  // Portal route (for /, /api/*)
  routes.push(createPortalRoute(hostname, basePath, daemonPort));
  console.log(`Portal route: ${hostname}${basePath} -> localhost:${daemonPort}`);

  // Get sessions if daemon is running
  if (await isDaemonRunning()) {
    const sessions = await getSessions(config);
    for (const session of sessions) {
      routes.push(createSessionRoute(hostname, session.fullPath, session.port));
      console.log(`Session route: ${hostname}${session.fullPath}/* -> localhost:${session.port}`);
    }
  } else {
    console.log('Note: Daemon is not running. Run "ttyd-mux caddy sync" after starting sessions.');
  }

  if (serverInfo) {
    // Filter out existing ttyd-mux routes and add new ones
    const existingRoutes = serverInfo.server.routes ?? [];
    const cleanedRoutes = existingRoutes.filter((route) => {
      const matches = route.match ?? [];
      return !matches.some(
        (m) => m.host?.includes(hostname) && m.path?.some((p) => p.startsWith(basePath))
      );
    });
    await client.updateServerRoutes(serverInfo.name, [...routes, ...cleanedRoutes]);
  } else {
    await createNewServer(client, hostname, routes);
    console.log(`Created new server for ${hostname}`);
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

    // Find and remove all ttyd-mux routes (both proxy and static mode)
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
      console.log(`Removed all ttyd-mux routes for ${hostname}${basePath}/*`);
    } else {
      console.log(`No ttyd-mux routes found for ${hostname}${basePath}/*`);
    }
  } catch (error) {
    handleCliError('Error', error);
    process.exit(1);
  }
}

// Calculate route diff between daemon sessions and Caddy routes
function calculateRouteDiff(
  sessions: SessionResponse[],
  existingRoutes: Array<{ path: string; port: number }>
): { toAdd: SessionResponse[]; toRemove: Array<{ path: string; port: number }> } {
  const sessionPaths = new Set(sessions.map((s) => s.fullPath));

  const toAdd = sessions.filter(
    (session) => !existingRoutes.some((r) => r.path === session.fullPath && r.port === session.port)
  );

  const toRemove = existingRoutes.filter((r) => !sessionPaths.has(r.path));

  return { toAdd, toRemove };
}

// Check if portal route exists in routes
function hasPortalRoute(routes: CaddyRoute[], hostname: string, basePath: string): boolean {
  return routes.some((route) => {
    const matches = route.match ?? [];
    return matches.some(
      (m) =>
        m.host?.includes(hostname) &&
        m.path?.some((p) => p === basePath || p === `${basePath}/` || p === `${basePath}/api/*`)
    );
  });
}

// Report sync changes to console
function reportSyncChanges(
  hostname: string,
  toAdd: SessionResponse[],
  toRemove: Array<{ path: string; port: number }>
): void {
  for (const session of toAdd) {
    console.log(`Added: ${hostname}${session.fullPath}/* -> localhost:${session.port}`);
  }
  for (const removed of toRemove) {
    console.log(`Removed: ${hostname}${removed.path}/* -> localhost:${removed.port}`);
  }
  console.log('');
  console.log(`Sync complete. ${toAdd.length} added, ${toRemove.length} removed.`);
}

// Sync session routes (static mode only)
export async function caddySyncCommand(options: CaddyOptions): Promise<void> {
  const config = loadConfig(options.config);

  if (config.proxy_mode !== 'static') {
    console.log('Note: sync command is only needed in static mode.');
    console.log('Current proxy_mode is "proxy". Sessions are automatically proxied.');
    return;
  }

  const hostname = getHostname(options, config);
  requireHostname(hostname);

  if (!(await isDaemonRunning())) {
    console.error('Error: Daemon is not running. Start daemon first with "ttyd-mux daemon"');
    process.exit(1);
  }

  const adminApi = getAdminApi(options, config);
  const client = await connectToCaddyOrExit(adminApi);
  const basePath = config.base_path;
  const daemonPort = config.daemon_port;

  try {
    const serverInfo = await getServerInfoOrExit(client, hostname);
    const sessions = await getSessions(config);
    const sessionPaths = new Set(sessions.map((s) => s.fullPath));
    const existingSessionRoutes = getSessionRoutes(serverInfo.server, hostname, basePath);

    const { toAdd, toRemove } = calculateRouteDiff(sessions, existingSessionRoutes);

    if (toAdd.length === 0 && toRemove.length === 0) {
      console.log('Routes are up to date. No changes needed.');
      return;
    }

    // Build new routes
    const existingRoutes = serverInfo.server.routes ?? [];
    let newRoutes = filterOutSessionRoutes(existingRoutes, hostname, basePath, sessionPaths);

    const sessionRoutes = toAdd.map((s) => createSessionRoute(hostname, s.fullPath, s.port));

    if (!hasPortalRoute(newRoutes, hostname, basePath)) {
      sessionRoutes.push(createPortalRoute(hostname, basePath, daemonPort));
      console.log(`Added portal route: ${hostname}${basePath} -> localhost:${daemonPort}`);
    }

    newRoutes = [...sessionRoutes, ...newRoutes];
    await client.updateServerRoutes(serverInfo.name, newRoutes);

    reportSyncChanges(hostname, toAdd, toRemove);
  } catch (error) {
    handleCliError('Error', error);
    process.exit(1);
  }
}

async function connectToCaddyOrExit(adminApi: string): Promise<CaddyClient> {
  try {
    return await connectToCaddy(adminApi);
  } catch {
    console.error(`Error: Cannot connect to Caddy Admin API at ${adminApi}`);
    console.error('Make sure Caddy is running and admin API is enabled.');
    process.exit(1);
  }
}

async function getServerInfoOrExit(
  client: CaddyClient,
  hostname: string
): Promise<{ name: string; server: CaddyServer }> {
  const servers = await client.getServers();
  const serverInfo = findServerForHost(servers, hostname);

  if (!serverInfo) {
    console.error(`Error: No server found for hostname ${hostname}`);
    console.error('Run "ttyd-mux caddy setup --hostname <hostname>" first.');
    process.exit(1);
  }

  return serverInfo;
}

// Show current Caddy status
export async function caddyStatusCommand(options: CaddyOptions): Promise<void> {
  const config = loadConfig(options.config);
  const adminApi = getAdminApi(options, config);
  const basePath = config.base_path;
  const client = await connectToCaddyOrExit(adminApi);

  console.log(`Caddy Admin API: ${adminApi}`);
  console.log(`Proxy Mode: ${config.proxy_mode}`);
  console.log('');

  const servers = await client.getServers();

  if (Object.keys(servers).length === 0) {
    console.log('No HTTP servers configured.');
    return;
  }

  const routes = findTtydMuxRoutes(servers, basePath);

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
