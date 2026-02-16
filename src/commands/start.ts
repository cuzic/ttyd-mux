import { startSession as apiStartSession, ensureDaemon } from '../client/index.js';
import { findSessionDefinition, getFullPath, loadConfig } from '../config/config.js';
import { handleCliError } from '../utils/errors.js';

export interface StartOptions {
  all?: boolean;
  config?: string;
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
    console.error('Session name required. Use --all to start all sessions.');
    process.exit(1);
  }

  // Find session definition
  const sessionDef = findSessionDefinition(config, name);
  if (!sessionDef) {
    console.error(`Session "${name}" not found in config.`);
    process.exit(1);
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
