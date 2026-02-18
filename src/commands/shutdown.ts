import { isDaemonRunning, shutdownDaemon } from '@/client/index.js';

export interface ShutdownOptions {
  config?: string;
  stopSessions?: boolean;
}

export async function shutdownCommand(options: ShutdownOptions): Promise<void> {
  const running = await isDaemonRunning();

  if (!running) {
    console.log('Daemon is not running.');
    return;
  }

  if (options.stopSessions) {
    console.log('Stopping all sessions and shutting down daemon...');
  } else {
    console.log('Shutting down daemon (sessions will be preserved)...');
  }

  await shutdownDaemon({ stopSessions: options.stopSessions });
}
