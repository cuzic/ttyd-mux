import { isDaemonRunning, shutdownDaemon } from '@/core/client/index.js';

export interface ShutdownOptions {
  config?: string;
  stopSessions?: boolean;
  killTmux?: boolean;
}

export async function shutdownCommand(options: ShutdownOptions): Promise<void> {
  const running = await isDaemonRunning();

  if (!running) {
    console.log('Daemon is not running.');
    return;
  }

  if (options.stopSessions && options.killTmux) {
    console.log('Stopping all sessions and killing tmux sessions...');
  } else if (options.stopSessions) {
    console.log('Stopping all sessions...');
  } else {
    console.log('Shutting down daemon (sessions will be preserved)...');
  }

  await shutdownDaemon({
    stopSessions: options.stopSessions,
    killTmux: options.killTmux
  });
}
