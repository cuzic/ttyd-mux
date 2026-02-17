import { isDaemonRunning, shutdownDaemon } from '@/client/index.js';

export interface ShutdownOptions {
  config?: string;
}

export async function shutdownCommand(_options: ShutdownOptions): Promise<void> {
  const running = await isDaemonRunning();

  if (!running) {
    console.log('Daemon is not running.');
    return;
  }

  await shutdownDaemon();
}
