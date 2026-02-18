import { ensureDaemon, getSessions, stopSession } from '@/client/index.js';
import { loadConfig } from '@/config/config.js';
import { handleCliError } from '@/utils/errors.js';

export interface DownOptions {
  config?: string;
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
      console.error('\nTo stop a specific session: ttyd-mux stop <name>');
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
