import { getFullPath } from '@/config/config.js';
import type { Config, SessionState } from '@/config/types.js';

export interface CaddyfileOptions {
  hostname: string;
  portalDir: string;
}

export function generateCaddyfileSnippet(
  config: Config,
  sessions: SessionState[],
  options: CaddyfileOptions
): string {
  const { hostname, portalDir } = options;
  const basePath = config.base_path;

  const lines: string[] = [
    `# ttyd-mux static mode configuration for ${hostname}`,
    `# Generated at ${new Date().toISOString()}`,
    '# Add this inside your site block in Caddyfile',
    '',
    '# Portal page (static HTML)',
    `handle ${basePath} {`,
    '    rewrite * /index.html',
    `    root * ${portalDir}`,
    '    file_server',
    '}',
    '',
    `handle ${basePath}/ {`,
    '    rewrite * /index.html',
    `    root * ${portalDir}`,
    '    file_server',
    '}'
  ];

  if (sessions.length > 0) {
    lines.push('', '# Session routes (direct to ttyd)');

    for (const session of sessions) {
      const fullPath = getFullPath(config, session.path);
      lines.push('', `# Session: ${session.name}`);
      lines.push(`handle ${fullPath}/* {`);
      lines.push(`    reverse_proxy localhost:${session.port}`);
      lines.push('}');
    }
  }

  return lines.join('\n');
}

export function generateCaddyJson(
  config: Config,
  sessions: SessionState[],
  options: CaddyfileOptions
): object {
  const { hostname, portalDir } = options;
  const basePath = config.base_path;

  const routes: object[] = [];

  // Portal routes
  routes.push({
    match: [{ host: [hostname], path: [basePath, `${basePath}/`] }],
    handle: [
      { handler: 'rewrite', uri: '/index.html' },
      { handler: 'file_server', root: portalDir }
    ]
  });

  // Session routes
  for (const session of sessions) {
    const fullPath = getFullPath(config, session.path);
    routes.push({
      match: [{ host: [hostname], path: [`${fullPath}/*`] }],
      handle: [
        {
          handler: 'reverse_proxy',
          upstreams: [{ dial: `localhost:${session.port}` }]
        }
      ]
    });
  }

  return { routes };
}
