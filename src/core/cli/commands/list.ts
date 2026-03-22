import { getSessions, getTmuxSessions } from '@/core/client/index.js';
import { loadConfig } from '@/core/config/config.js';
import { buildSessionUrl } from '@/core/cli/helpers/url-builder.js';
import { guardDaemon } from '@/core/cli/helpers/daemon-guard.js';
import { CliError } from '@/utils/errors.js';

export interface ListOptions {
  config?: string;
  long?: boolean;
  url?: boolean;
  json?: boolean;
}

interface SessionListItem {
  name: string;
  dir: string;
  path: string;
  url: string;
  attached: boolean;
  tmux?: {
    windows: number;
    cwd?: string;
  };
}

export async function listCommand(options: ListOptions): Promise<void> {
  const config = loadConfig(options.config);

  const guard = await guardDaemon({ json: options.json });
  if (!guard.running) {
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

    // JSON output mode
    if (options.json) {
      const sessions: SessionListItem[] = [];

      if (tmuxData.installed && tmuxData.sessions.length > 0) {
        for (const tmuxSession of tmuxData.sessions) {
          const attached = attachedMap.get(tmuxSession.name);
          sessions.push({
            name: tmuxSession.name,
            dir: tmuxSession.cwd ?? '',
            path: attached?.path ?? '',
            url: attached ? buildSessionUrl(config, attached.path) : '',
            attached: !!attached,
            tmux: {
              windows: tmuxSession.windows,
              cwd: tmuxSession.cwd
            }
          });
        }
      } else {
        for (const session of buntermSessions) {
          sessions.push({
            name: session.name,
            dir: session.dir,
            path: session.path,
            url: buildSessionUrl(config, session.path),
            attached: true
          });
        }
      }

      console.log(JSON.stringify({ sessions, daemon: true, tmuxInstalled: tmuxData.installed }));
      return;
    }

    // Text output mode
    if (tmuxData.installed && tmuxData.sessions.length > 0) {
      // tmux is installed: show tmux sessions with attached status
      for (const tmuxSession of tmuxData.sessions) {
        const attached = attachedMap.get(tmuxSession.name);
        const status = attached ? ' (attached)' : '';

        if (options.url && attached) {
          const url = buildSessionUrl(config, attached.path);
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
        console.log('Run "bunterm up" to start a session.');
        return;
      }

      for (const session of buntermSessions) {
        if (options.url) {
          const url = buildSessionUrl(config, session.path);
          console.log(url);
        } else if (options.long) {
          console.log(`${session.name}\t${session.dir}\t${session.path}`);
        } else {
          console.log(session.name);
        }
      }
    }
  } catch (error) {
    throw CliError.from(error, 'Failed to list sessions');
  }
}
