/**
 * Session Resolver
 *
 * Common session lookup patterns.
 */

import { getSessions } from '@/core/client/index.js';
import type { Config, SessionResponse } from '@/core/config/types.js';
import { sessionNotFound, type SessionNotFoundError } from '@/core/errors.js';
import { CliError } from '@/utils/errors.js';
import { err, ok, type Result } from '@/utils/result.js';

/**
 * Find a session by name
 */
export async function findSessionByName(
  config: Config,
  name: string
): Promise<SessionResponse | undefined> {
  const sessions = await getSessions(config);
  return sessions.find((s) => s.name === name);
}

/**
 * Find a session for the current working directory
 */
export async function findSessionForCwd(config: Config): Promise<SessionResponse | undefined> {
  const sessions = await getSessions(config);
  const cwd = process.cwd();
  return sessions.find((s) => s.dir === cwd);
}

/**
 * Require a session by name, throw CliError if not found
 */
export async function requireSessionByName(
  config: Config,
  name: string
): Promise<SessionResponse> {
  const session = await findSessionByName(config, name);
  if (!session) {
    throw new CliError(`Session '${name}' not found`);
  }
  return session;
}

/**
 * Require a session for the current directory, throw CliError if not found
 */
export async function requireSessionForCwd(config: Config): Promise<SessionResponse> {
  const session = await findSessionForCwd(config);
  if (!session) {
    throw new CliError('No session found for current directory');
  }
  return session;
}

// === Result-returning versions ===

/**
 * Get session by name, returning Result
 */
export async function getSessionByName(
  config: Config,
  name: string
): Promise<Result<SessionResponse, SessionNotFoundError>> {
  const session = await findSessionByName(config, name);
  if (!session) {
    return err(sessionNotFound(name));
  }
  return ok(session);
}

/**
 * Get session for current directory, returning Result
 */
export async function getSessionForCwd(
  config: Config
): Promise<Result<SessionResponse, SessionNotFoundError>> {
  const session = await findSessionForCwd(config);
  if (!session) {
    const cwd = process.cwd();
    return err(sessionNotFound(cwd));
  }
  return ok(session);
}
