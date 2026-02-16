import { ensureDaemon, getSessions, stopSession } from '../client/index.js';
import { loadConfig } from '../config/config.js';
import { handleCliError } from '../utils/errors.js';

export interface StopOptions {
  all?: boolean;
  config?: string;
}

export async function stopCommand(name: string | undefined, options: StopOptions): Promise<void> {
  const config = loadConfig(options.config);

  // Ensure daemon is running
  await ensureDaemon(options.config);

  if (options.all) {
    // Stop all sessions
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
    return;
  }

  if (!name) {
    console.error('Session name required. Use --all to stop all sessions.');
    process.exit(1);
  }

  try {
    await stopSession(config, name);
    console.log(`Session "${name}" stopped`);
  } catch (error) {
    handleCliError('Failed to stop session', error);
    process.exit(1);
  }
}
