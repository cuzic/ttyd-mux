import { ensureDaemon, getSessions, shutdownDaemon, stopSession } from '@/client/index.js';
import { loadConfig } from '@/config/config.js';
import { handleCliError } from '@/utils/errors.js';

export interface DownOptions {
  config?: string;
  killTmux?: boolean;
}

export async function downCommand(options: DownOptions): Promise<void> {
  const config = loadConfig(options.config);
  const dir = process.cwd();

  // Ensure daemon is running
  await ensureDaemon(options.config);

  // Find session for current directory
  const sessions = await getSessions(config);
  const session = sessions.find((s) => s.dir === dir);

  if (!session) {
    console.error(`No session found for directory: ${dir}`);
    if (sessions.length > 0) {
      console.error('\nRunning sessions:');
      for (const s of sessions) {
        console.error(`  - ${s.name} (${s.dir})`);
      }
    } else {
      console.error('\nNo sessions are currently running.');
      console.error('Start one with: ttyd-mux up');
    }
    process.exit(1);
  }

  try {
    await stopSession(config, session.name, { killTmux: options.killTmux });
    if (options.killTmux) {
      console.log(`Session "${session.name}" stopped (tmux session terminated)`);
    } else {
      console.log(`Session "${session.name}" stopped`);
    }

    // Check if there are any remaining sessions
    const remainingSessions = await getSessions(config);
    if (remainingSessions.length === 0) {
      console.log('No sessions remaining, stopping daemon...');
      await shutdownDaemon();
    }
  } catch (error) {
    handleCliError('Failed to stop session', error);
    process.exit(1);
  }
}
