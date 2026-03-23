/**
 * Connections command — List and revoke authenticated cookie sessions
 */

import { guardDaemon } from '@/core/cli/helpers/daemon-guard.js';
import { apiRequest } from '@/core/client/index.js';
import { loadConfig } from '@/core/config/config.js';
import { CliError } from '@/utils/errors.js';

export interface ConnectionsOptions {
  config?: string;
  json?: boolean;
}

export interface ConnectionsRevokeOptions {
  config?: string;
}

interface AuthSessionInfo {
  id: string;
  remoteAddr: string;
  createdAt: string;
  expiresAt: string;
}

export async function connectionsCommand(options: ConnectionsOptions): Promise<void> {
  const config = loadConfig(options.config);

  const guard = await guardDaemon({ json: options.json });
  if (!guard.running) {
    return;
  }

  try {
    const sessions = await apiRequest<AuthSessionInfo[]>(config, 'GET', '/api/auth/sessions');

    if (options.json) {
      console.log(JSON.stringify({ sessions }));
      return;
    }

    if (sessions.length === 0) {
      console.log('No active authenticated sessions.');
      return;
    }

    // Table header
    console.log('ID        Remote Address          Created                   Expires');
    console.log(
      '--------  ----------------------  ------------------------  ------------------------'
    );

    for (const session of sessions) {
      const created = new Date(session.createdAt).toLocaleString();
      const expires = new Date(session.expiresAt).toLocaleString();
      const id = session.id.padEnd(8);
      const addr = session.remoteAddr.padEnd(22);
      const createdStr = created.padEnd(24);
      console.log(`${id}  ${addr}  ${createdStr}  ${expires}`);
    }

    console.log(`\n${sessions.length} active session(s).`);
    console.log('Use "bunterm connections revoke <id>" to revoke a session.');
  } catch (error) {
    throw CliError.from(error, 'Failed to list connections');
  }
}

export async function connectionsRevokeCommand(
  id: string,
  options: ConnectionsRevokeOptions
): Promise<void> {
  const config = loadConfig(options.config);

  const guard = await guardDaemon();
  if (!guard.running) {
    return;
  }

  try {
    await apiRequest<{ revoked: boolean; id: string }>(
      config,
      'DELETE',
      `/api/auth/sessions/${encodeURIComponent(id)}`
    );

    console.log(`Session ${id} revoked.`);
  } catch (error) {
    throw CliError.from(error, `Failed to revoke session ${id}`);
  }
}
