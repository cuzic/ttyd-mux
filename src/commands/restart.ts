import { isDaemonRunning, restartDaemon } from '@/client/index.js';

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
    console.log('Daemon is running.');
  } catch (err) {
    console.error(`Failed to restart daemon: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}
