import { isDaemonRunning } from '../client/index.js';
import { startDaemon } from '../daemon/index.js';

export interface DaemonOptions {
  foreground?: boolean;
  config?: string;
}

export async function daemonCommand(options: DaemonOptions): Promise<void> {
  // Check if already running
  if (await isDaemonRunning()) {
    console.log('Daemon is already running.');
    console.log('Use "ttyd-mux shutdown" to stop it first.');
    process.exit(1);
  }

  if (options.foreground) {
    // Run in foreground
    await startDaemon({
      configPath: options.config,
      foreground: true
    });
  } else {
    // Import and use ensureDaemon to start in background
    const { ensureDaemon } = await import('../client/index.js');
    await ensureDaemon(options.config);
    console.log('Daemon started in background.');
  }
}
