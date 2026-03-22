import { isDaemonRunning, restartDaemon } from '@/core/client/index.js';
import { CliError } from '@/utils/errors.js';

export interface RestartOptions {
  config?: string;
}

export async function restartCommand(options: RestartOptions): Promise<void> {
  const wasRunning = await isDaemonRunning();

  if (wasRunning) {
    console.log('Restarting daemon...');
  } else {
    console.log('Starting daemon...');
  }

  try {
    await restartDaemon({ configPath: options.config });
    console.log('Daemon restarted successfully');
  } catch (error) {
    throw CliError.from(error, 'Failed to restart daemon');
  }
}
