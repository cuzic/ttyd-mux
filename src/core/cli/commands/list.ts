import { getSessions, getTmuxSessions, isDaemonRunning } from '@/core/client/index.js';
import { getFullPath, loadConfig } from '@/core/config/config.js';
import { handleCliError } from '@/utils/errors.js';

export interface ListOptions {
  config?: string;
  long?: boolean;
  url?: boolean;
}

export async function listCommand(options: ListOptions): Promise<void> {
  const config = loadConfig(options.config);

  if (!(await isDaemonRunning())) {
    // No sessions (daemon not running)
    return;
  }

  try {
    // Get bunterm sessions and tmux sessions
    const [buntermSessions, tmuxData] = await Promise.all([
      getSessions(config),
      getTmuxSessions(config)
    ]);

    // Build a map of tmux session name -> bunterm session (if attached)
    const attachedMap = new Map<string, (typeof buntermSessions)[0]>();
    for (const s of buntermSessions) {
      if (s.tmuxSession) {
        attachedMap.set(s.tmuxSession, s);
      }
    }

    if (tmuxData.installed && tmuxData.sessions.length > 0) {
      // tmux is installed: show tmux sessions with attached status
      for (const tmuxSession of tmuxData.sessions) {
        const attached = attachedMap.get(tmuxSession.name);
        const status = attached ? ' (attached)' : '';

        if (options.url && attached) {
          const fullPath = getFullPath(config, attached.path);
          const url = `http://localhost:${config.daemon_port}${fullPath}/`;
          console.log(url);
        } else if (options.long) {
          const cwd = tmuxSession.cwd ?? '';
          console.log(`${tmuxSession.name}\t${cwd}\t${tmuxSession.windows} windows${status}`);
        } else {
          console.log(`${tmuxSession.name}${status}`);
        }
      }
    } else {
      // tmux not installed or no tmux sessions: show bunterm sessions directly
      if (buntermSessions.length === 0) {
        console.log('No active sessions.');
        return;
      }

      for (const session of buntermSessions) {
        if (options.url) {
          const fullPath = getFullPath(config, session.path);
          const url = `http://localhost:${config.daemon_port}${fullPath}/`;
          console.log(url);
        } else if (options.long) {
          console.log(`${session.name}\t${session.dir}\t${session.path}`);
        } else {
          console.log(session.name);
        }
      }
    }
  } catch (error) {
    handleCliError('Failed to list sessions', error);
    process.exit(1);
  }
}
