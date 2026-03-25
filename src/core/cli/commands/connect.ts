/**
 * Connect command - Attach to a running session from terminal
 */

import { ConnectOptionsSchema, parseCliOptions } from '@/core/cli/schemas.js';
import { attachToSession } from '@/core/cli/terminal-attach.js';
import { ensureDaemon, getSessions } from '@/core/client/index.js';
import { getFullPath, loadConfig } from '@/core/config/config.js';
import { attachSession as tmuxAttach } from '@/tmux.js';
import { sanitizeName } from '@/utils/command-template.js';
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

  // If command uses tmux, delegate to tmux attach
  const commandStr = Array.isArray(config.command)
    ? config.command.join(' ')
    : (config.command ?? '');
  if (commandStr.includes('tmux')) {
    const tmuxSessionName = sanitizeName(sessionName);
    return tmuxAttach(tmuxSessionName);
  }

  // Non-tmux: use WebSocket terminal attach
  const fullPath = getFullPath(config, session.path);
  const wsUrl = `ws://localhost:${config.daemon_port}${fullPath}/ws`;
  console.log(`Connecting to ${sessionName}...`);
  return attachToSession({ url: wsUrl });
}
