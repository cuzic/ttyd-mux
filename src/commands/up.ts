import { startSession as apiStartSession, ensureDaemon } from '../client/index.js';
import { getFullPath, loadConfig } from '../config/config.js';
import { attachSession } from '../tmux.js';
import { getErrorMessage } from '../utils/errors.js';

export interface UpOptions {
  name?: string;
  config?: string;
  attach?: boolean;
  detach?: boolean;
}

export async function upCommand(options: UpOptions): Promise<void> {
  const config = loadConfig(options.config);
  const dir = process.cwd();
  const name = options.name ?? dir.split('/').pop() ?? 'default';

  // Determine whether to attach
  // Priority: --detach > --attach > config.auto_attach
  const shouldAttach = options.detach ? false : (options.attach ?? config.auto_attach ?? true);

  // Ensure daemon is running
  await ensureDaemon(options.config);

  // Start session
  try {
    const session = await apiStartSession(config, {
      name,
      dir
    });

    const fullPath = getFullPath(config, session.path);
    const url = `http://localhost:${config.daemon_port}${fullPath}/`;

    console.log(`Session "${session.name}" started`);
    console.log(`  Port: ${session.port}`);
    console.log(`  Path: ${fullPath}`);
    console.log(`  URL:  ${url}`);

    // Attach to tmux session if enabled
    if (shouldAttach) {
      await attachSession(session.name);
    }
  } catch (error) {
    const message = getErrorMessage(error);
    // If session already exists, just attach to it
    if (message.includes('already running')) {
      if (shouldAttach) {
        console.log(`Session "${name}" is already running, attaching...`);
        await attachSession(name);
      } else {
        console.log(`Session "${name}" is already running`);
      }
      return;
    }
    console.error(`Failed to start session: ${message}`);
    process.exit(1);
  }
}
