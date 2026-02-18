import { startSession as apiStartSession, ensureDaemon } from '@/client/index.js';
import { findSessionDefinition, getFullPath, loadConfig } from '@/config/config.js';
import type { Config } from '@/config/types.js';
import { handleCliError } from '@/utils/errors.js';

export interface StartOptions {
  all?: boolean;
  config?: string;
}

function handleSessionNotFound(name: string, config: Config): never {
  const available = config.sessions?.map((s) => s.name) ?? [];
  console.error(`Session "${name}" not found in config.`);
  if (available.length > 0) {
    console.error(`\nAvailable sessions: ${available.join(', ')}`);
  } else {
    console.error('\nNo sessions defined in config.');
    console.error('To start a session in the current directory: ttyd-mux up');
  }
  process.exit(1);
}

export async function startCommand(name: string | undefined, options: StartOptions): Promise<void> {
  const config = loadConfig(options.config);

  // Ensure daemon is running
  await ensureDaemon(options.config);

  if (options.all) {
    // Start all predefined sessions
    const sessions = config.sessions ?? [];
    if (sessions.length === 0) {
      console.log('No sessions defined in config.');
      return;
    }

    for (const sessionDef of sessions) {
      try {
        const session = await apiStartSession(config, {
          name: sessionDef.name,
          dir: sessionDef.dir,
          path: sessionDef.path
        });

        const fullPath = getFullPath(config, session.path);
        console.log(`Started "${session.name}" on :${session.port} (${fullPath})`);
      } catch (error) {
        handleCliError(`Failed to start "${sessionDef.name}"`, error);
      }
    }
    return;
  }

  if (!name) {
    console.error('Session name required.');
    console.error('  Usage: ttyd-mux start <session-name>');
    console.error('  Or use --all to start all predefined sessions.');
    process.exit(1);
  }

  // Find session definition
  const sessionDef = findSessionDefinition(config, name);
  if (!sessionDef) {
    handleSessionNotFound(name, config);
  }

  try {
    const session = await apiStartSession(config, {
      name: sessionDef.name,
      dir: sessionDef.dir,
      path: sessionDef.path
    });

    const fullPath = getFullPath(config, session.path);
    const url = `http://localhost:${config.daemon_port}${fullPath}/`;

    console.log(`Session "${session.name}" started`);
    console.log(`  Port: ${session.port}`);
    console.log(`  Path: ${fullPath}`);
    console.log(`  URL:  ${url}`);
  } catch (error) {
    handleCliError('Failed to start session', error);
    process.exit(1);
  }
}
