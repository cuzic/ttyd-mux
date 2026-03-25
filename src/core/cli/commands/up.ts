/**
 * Up command - Start session for current directory
 */

import { buildSessionUrl } from '@/core/cli/helpers/url-builder.js';
import { parseCliOptions, type UpOptions, UpOptionsSchema } from '@/core/cli/schemas.js';
import { attachToSession } from '@/core/cli/terminal-attach.js';
import { startSession as apiStartSession, ensureDaemon, getSessions } from '@/core/client/index.js';
import { getFullPath, loadConfig } from '@/core/config/config.js';
import { CliError, getErrorMessage } from '@/utils/errors.js';

export type { UpOptions };

export async function upCommand(rawOptions: unknown): Promise<number | undefined> {
  const options = parseCliOptions(rawOptions, UpOptionsSchema, 'up');
  const config = loadConfig(options.config);
  const dir = process.cwd();
  const name = options.name ?? dir.split('/').pop() ?? 'default';

  // Ensure daemon is running
  await ensureDaemon(options.config, config.daemon_manager);

  let sessionPath: string | undefined;

  try {
    const session = await apiStartSession(config, {
      name,
      dir
    });

    sessionPath = session.path;
    const url = buildSessionUrl(config, session.path);
    console.log(`Session started: ${session.name}`);
    console.log(`URL: ${url}`);
  } catch (error) {
    const message = getErrorMessage(error);
    // Handle "already exists" or "already running" errors
    if (message.includes('already exists') || message.includes('already running')) {
      // Get existing session info
      const sessions = await getSessions(config);
      const existing = sessions.find((s) => s.name === name);

      if (existing) {
        sessionPath = existing.path;
        const url = buildSessionUrl(config, existing.path);
        console.log(`Session '${name}' is already running.`);
        console.log(`URL: ${url}`);
      } else {
        console.log(`Session '${name}' is already running.`);
        return;
      }
    } else {
      throw new CliError(`Failed to start session: ${message}`);
    }
  }

  // Attach to terminal if requested (CLI flag or config default)
  const shouldAttach = options.attach ?? config.attach_on_up;
  if (shouldAttach && sessionPath) {
    const fullPath = getFullPath(config, sessionPath);
    const wsUrl = `ws://localhost:${config.daemon_port}${fullPath}/ws`;
    console.log('Attaching to terminal...');
    return attachToSession({ url: wsUrl });
  }

  return undefined;
}
