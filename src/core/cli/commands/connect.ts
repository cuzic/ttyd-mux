/**
 * Connect command - Attach to a running session from terminal
 */

import { ConnectOptionsSchema, parseCliOptions } from '@/core/cli/schemas.js';
import { attachToSession } from '@/core/cli/terminal-attach.js';
import { ensureDaemon, getSessions } from '@/core/client/index.js';
import { loadConfig } from '@/core/config/config.js';
import { getStateDir } from '@/core/config/state.js';
import { CliError } from '@/utils/errors.js';

export async function connectCommand(
  name: string | undefined,
  rawOptions: unknown
): Promise<number> {
  const options = parseCliOptions(rawOptions, ConnectOptionsSchema, 'connect');
  const config = loadConfig(options.config);

  // Ensure daemon is running
  await ensureDaemon(options.config, config.daemon_manager);

  // Determine session name: explicit arg > cwd basename > 'default'
  const sessionName = name ?? process.cwd().split('/').pop() ?? 'default';

  // Verify session exists
  const sessions = await getSessions(config);
  const session = sessions.find((s) => s.name === sessionName);
  if (!session) {
    throw new CliError(`Session '${sessionName}' not found. Run 'bunterm up' first.`);
  }

  // Build Unix socket path and attach
  const stateDir = getStateDir();
  const socketPath = `${stateDir}/sessions/${sessionName}.sock`;
  console.log(`Connecting to ${sessionName}...`);
  return attachToSession({ socketPath });
}
