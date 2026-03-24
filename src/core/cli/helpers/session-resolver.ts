/**
 * Session Resolver (CLI)
 *
 * Throw-based session lookup for CLI commands.
 * Throws CliError when session not found.
 */

import { getSessions } from '@/core/client/index.js';
import type { Config } from '@/core/config/types.js';
import { CliError } from '@/utils/errors.js';

/**
 * Get session by name, throw CliError if not found
 */
export async function requireSessionByName(config: Config, name: string) {
  const sessions = await getSessions(config);
  const session = sessions.find((s) => s.name === name);
  if (!session) {
    throw new CliError(`Session '${name}' not found`);
  }
  return session;
}

/**
 * Get session for current directory, throw CliError if not found
 */
export async function requireSessionForCwd(config: Config) {
  const sessions = await getSessions(config);
  const cwd = process.cwd();
  const session = sessions.find((s) => s.dir === cwd);
  if (!session) {
    throw new CliError('No session found for current directory');
  }
  return session;
}
