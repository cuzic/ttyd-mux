import { getStatus, isDaemonRunning } from '@/client/index.js';
import { getFullPath, loadConfig } from '@/config/config.js';
import { handleCliError } from '@/utils/errors.js';

export interface StatusOptions {
  config?: string;
}

export async function statusCommand(options: StatusOptions): Promise<void> {
  const config = loadConfig(options.config);

  const running = await isDaemonRunning();
  if (!running) {
    console.log('Daemon: not running');
    console.log('\nStart daemon with: ttyd-mux daemon');
    return;
  }

  try {
    const status = await getStatus(config);

    console.log('Daemon: running');
    if (status.daemon) {
      console.log(`  PID:  ${status.daemon.pid}`);
      console.log(`  Port: ${status.daemon.port}`);
    }

    console.log('\nSessions:');
    if (status.sessions.length === 0) {
      console.log('  (no active sessions)');
    } else {
      for (const session of status.sessions) {
        const fullPath = getFullPath(config, session.path);
        console.log(`  ${session.name}`);
        console.log(`    Port: ${session.port}`);
        console.log(`    Path: ${fullPath}`);
        console.log(`    Dir:  ${session.dir}`);
      }
    }
  } catch (error) {
    handleCliError('Failed to get status', error);
    process.exit(1);
  }
}
