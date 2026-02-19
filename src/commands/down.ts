import { ensureDaemon, getSessions, stopSession } from '@/client/index.js';
import { loadConfig } from '@/config/config.js';
import type { Config } from '@/config/types.js';
import { handleCliError } from '@/utils/errors.js';

export interface DownOptions {
  config?: string;
  all?: boolean;
}

/**
 * Stop session for current directory
 */
async function stopCurrentDirSession(config: Config): Promise<void> {
  const dir = process.cwd();

  const sessions = await getSessions(config);
  const session = sessions.find((s) => s.dir === dir);

  if (!session) {
    console.error(`No session found for directory: ${dir}`);
    if (sessions.length > 0) {
      console.error('\nRunning sessions:');
      for (const s of sessions) {
        console.error(`  - ${s.name} (${s.dir})`);
      }
      console.error('\nTo stop a specific session: ttyd-mux down <name>');
    } else {
      console.error('\nNo sessions are currently running.');
      console.error('Start one with: ttyd-mux up');
    }
    process.exit(1);
  }

  try {
    await stopSession(config, session.name);
    console.log(`Session "${session.name}" stopped`);
  } catch (error) {
    handleCliError('Failed to stop session', error);
    process.exit(1);
  }
}

/**
 * Stop a named session
 */
async function stopNamedSession(config: Config, name: string): Promise<void> {
  try {
    await stopSession(config, name);
    console.log(`Session "${name}" stopped`);
  } catch (error) {
    handleCliError('Failed to stop session', error);
    process.exit(1);
  }
}

/**
 * Stop all sessions
 */
async function stopAllSessions(config: Config): Promise<void> {
  const sessions = await getSessions(config);
  if (sessions.length === 0) {
    console.log('No active sessions.');
    return;
  }

  for (const session of sessions) {
    try {
      await stopSession(config, session.name);
      console.log(`Stopped "${session.name}"`);
    } catch (error) {
      handleCliError(`Failed to stop "${session.name}"`, error);
    }
  }
}

export async function downCommand(name: string | undefined, options: DownOptions): Promise<void> {
  const config = loadConfig(options.config);

  // Ensure daemon is running
  await ensureDaemon(options.config);

  if (options.all) {
    // Stop all sessions
    await stopAllSessions(config);
  } else if (name) {
    // Stop named session
    await stopNamedSession(config, name);
  } else {
    // Stop session for current directory
    await stopCurrentDirSession(config);
  }
}
