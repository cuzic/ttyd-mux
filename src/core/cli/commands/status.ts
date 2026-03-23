/**
 * Status command - Show daemon and session status
 */

import { buildSessionUrl } from '@/core/cli/helpers/url-builder.js';
import { formatPm2StatusLine, getPm2Status } from '@/core/cli/services/status-service.js';
import { getStatus, isDaemonRunning } from '@/core/client/index.js';
import { loadConfig } from '@/core/config/config.js';
import { CliError } from '@/utils/errors.js';

export interface StatusOptions {
  config?: string;
  json?: boolean;
}

interface StatusJson {
  daemon: {
    running: boolean;
    port?: number;
    pm2?: { status: string; pid?: number; memory?: number; cpu?: number } | null;
  };
  sessions: Array<{
    name: string;
    dir: string;
    path: string;
    url: string;
  }>;
}

export async function statusCommand(options: StatusOptions): Promise<void> {
  const config = loadConfig(options.config);

  const running = await isDaemonRunning();
  const pm2Status = config.daemon_manager === 'pm2' ? getPm2Status() : null;

  // JSON output mode
  if (options.json) {
    const result: StatusJson = {
      daemon: {
        running,
        port: running ? config.daemon_port : undefined,
        pm2: pm2Status
      },
      sessions: []
    };

    if (running) {
      try {
        const status = await getStatus(config);
        result.sessions = status.sessions.map((session) => ({
          name: session.name,
          dir: session.dir,
          path: session.path,
          url: buildSessionUrl(config, session.path)
        }));
      } catch {
        // Ignore errors in JSON mode
      }
    }

    console.log(JSON.stringify(result));
    return;
  }

  // Text output mode
  // Show pm2 status if configured
  if (config.daemon_manager === 'pm2') {
    if (pm2Status) {
      console.log(formatPm2StatusLine(pm2Status));
    } else {
      console.log('pm2: not running');
    }
  }

  if (!running) {
    console.log('Daemon is not running.');
    console.log('Run "bunterm start" to start the daemon.');
    return;
  }

  try {
    const status = await getStatus(config);
    if (status.daemon) {
      console.log(`Daemon: running (port: ${config.daemon_port})`);
    }
    if (status.sessions.length === 0) {
      console.log('No active sessions.');
    } else {
      console.log(`Sessions (${status.sessions.length}):`);
      for (const session of status.sessions) {
        const url = buildSessionUrl(config, session.path);
        console.log(`  ${session.name}: ${url}`);
      }
    }
  } catch (error) {
    throw CliError.from(error, 'Failed to get status');
  }
}
