import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { getSessions, isDaemonRunning } from '../client/index.js';
import { loadConfig } from '../config/config.js';
import { getAllSessions } from '../config/state.js';
import type { Config, SessionState } from '../config/types.js';
import { generateCaddyJson, generateCaddyfileSnippet } from '../deploy/caddyfile.js';
import { generateDeployScript } from '../deploy/deploy-script.js';
import { generateStaticPortalHtml } from '../deploy/static-portal.js';

export interface DeployOptions {
  hostname?: string;
  output?: string;
  config?: string;
}

function getDefaultDeployDir(): string {
  return join(homedir(), '.local', 'share', 'ttyd-mux', 'deploy');
}

function getHostname(options: DeployOptions, config: Config): string | undefined {
  return options.hostname ?? config.hostname;
}

export async function deployCommand(options: DeployOptions): Promise<void> {
  const config = loadConfig(options.config);
  const hostname = getHostname(options, config);

  if (!hostname) {
    console.error('Error: --hostname is required (or set hostname in config.yaml)');
    process.exit(1);
  }

  const deployDir = options.output ?? getDefaultDeployDir();
  const portalDir = join(deployDir, 'portal');

  // Get sessions
  let sessions: SessionState[];
  if (await isDaemonRunning()) {
    const sessionResponses = await getSessions(config);
    sessions = sessionResponses.map((s) => ({
      name: s.name,
      pid: s.pid,
      port: s.port,
      path: s.path,
      dir: s.dir,
      started_at: s.started_at
    }));
  } else {
    // Fallback to state file
    sessions = getAllSessions();
  }

  console.log('ttyd-mux deploy');
  console.log('================');
  console.log('');
  console.log(`Hostname: ${hostname}`);
  console.log(`Output: ${deployDir}`);
  console.log(`Sessions: ${sessions.length}`);
  console.log('');

  // Create directories
  if (!existsSync(deployDir)) {
    mkdirSync(deployDir, { recursive: true });
  }
  if (!existsSync(portalDir)) {
    mkdirSync(portalDir, { recursive: true });
  }

  // Generate static portal HTML
  const portalHtml = generateStaticPortalHtml(config, sessions);
  const portalPath = join(portalDir, 'index.html');
  writeFileSync(portalPath, portalHtml);
  console.log(`Generated: ${portalPath}`);

  // Generate Caddyfile snippet
  const caddyfileSnippet = generateCaddyfileSnippet(config, sessions, {
    hostname,
    portalDir
  });
  const caddyfilePath = join(deployDir, 'Caddyfile.snippet');
  writeFileSync(caddyfilePath, caddyfileSnippet);
  console.log(`Generated: ${caddyfilePath}`);

  // Generate Caddy JSON routes
  const caddyJson = generateCaddyJson(config, sessions, {
    hostname,
    portalDir
  });
  const caddyJsonPath = join(deployDir, 'caddy-routes.json');
  writeFileSync(caddyJsonPath, JSON.stringify(caddyJson, null, 2));
  console.log(`Generated: ${caddyJsonPath}`);

  // Generate deploy script
  const deployScript = generateDeployScript(config, {
    hostname,
    deployDir,
    caddyAdminApi: config.caddy_admin_api
  });
  const scriptPath = join(deployDir, 'deploy.sh');
  writeFileSync(scriptPath, deployScript, { mode: 0o755 });
  console.log(`Generated: ${scriptPath}`);

  console.log('');
  console.log('Next steps:');
  console.log('');
  console.log('Option 1: Add snippet to Caddyfile');
  console.log(`  cat ${caddyfilePath}`);
  console.log('');
  console.log('Option 2: Use Caddy Admin API');
  console.log(`  ttyd-mux caddy setup --hostname ${hostname}`);
  console.log('');

  if (sessions.length > 0) {
    console.log('Sessions included:');
    for (const session of sessions) {
      console.log(`  - ${session.name} (:${session.port})`);
    }
  } else {
    console.log('Note: No sessions found. Start sessions with "ttyd-mux up" and run deploy again.');
  }
}
