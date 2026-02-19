import { startSession as apiStartSession, ensureDaemon } from '@/client/index.js';
import { findSessionDefinition, getFullPath, loadConfig } from '@/config/config.js';
import type { Config } from '@/config/types.js';
import { attachSession } from '@/tmux.js';
import { getErrorMessage, handleCliError } from '@/utils/errors.js';

export interface UpOptions {
  name?: string;
  config?: string;
  attach?: boolean;
  detach?: boolean;
  all?: boolean;
}

/**
 * Start a session for current directory
 */
async function startCurrentDirSession(
  config: Config,
  options: UpOptions
): Promise<void> {
  const dir = process.cwd();
  const name = options.name ?? dir.split('/').pop() ?? 'default';

  // Determine whether to attach
  const shouldAttach = options.detach ? false : (options.attach ?? config.auto_attach ?? true);

  try {
    const session = await apiStartSession(config, {
      name,
      dir
    });

    const fullPath = getFullPath(config, session.path);
    const url = `http://localhost:${config.daemon_port}${fullPath}/`;

    console.log(`Session "${session.name}" started`);
    console.log(`  Port: ${session.port}`);
    console.log(`  Path: ${fullPath}`);
    console.log(`  URL:  ${url}`);

    if (shouldAttach) {
      await attachSession(session.name);
    }
  } catch (error) {
    const message = getErrorMessage(error);
    if (message.includes('already running')) {
      if (shouldAttach) {
        console.log(`Session "${name}" is already running, attaching...`);
        await attachSession(name);
      } else {
        console.log(`Session "${name}" is already running`);
      }
      return;
    }
    console.error(`Failed to start session: ${message}`);
    process.exit(1);
  }
}

/**
 * Start a predefined session by name
 */
async function startNamedSession(
  config: Config,
  name: string,
  options: UpOptions
): Promise<void> {
  const sessionDef = findSessionDefinition(config, name);

  if (!sessionDef) {
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

  const shouldAttach = options.detach ? false : (options.attach ?? false);

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

    if (shouldAttach) {
      await attachSession(session.name);
    }
  } catch (error) {
    handleCliError('Failed to start session', error);
    process.exit(1);
  }
}

/**
 * Start all predefined sessions
 */
async function startAllSessions(config: Config): Promise<void> {
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
}

export async function upCommand(name: string | undefined, options: UpOptions): Promise<void> {
  const config = loadConfig(options.config);

  // Ensure daemon is running
  await ensureDaemon(options.config);

  if (options.all) {
    // Start all predefined sessions
    await startAllSessions(config);
  } else if (name) {
    // Start named session
    await startNamedSession(config, name, options);
  } else {
    // Start session for current directory
    await startCurrentDirSession(config, options);
  }
}
