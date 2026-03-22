import { getSessions, getTmuxSessions } from '@/core/client/index.js';
import type { Config } from '@/core/config/types.js';
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

interface ListData {
  sessions: SessionListItem[];
  tmuxInstalled: boolean;
}

// === Types ===

type BuntermSession = Awaited<ReturnType<typeof getSessions>>[0];
type TmuxData = Awaited<ReturnType<typeof getTmuxSessions>>;

// === Transformation ===

function buildSessionList(
  buntermSessions: BuntermSession[],
  tmuxData: TmuxData,
  config: Config
): ListData {
  // Build a map of tmux session name -> bunterm session (if attached)
  const attachedMap = new Map<string, BuntermSession>();
  for (const s of buntermSessions) {
    if (s.tmuxSession) {
      attachedMap.set(s.tmuxSession, s);
    }
  }

  const sessions: SessionListItem[] = [];

  if (tmuxData.installed && tmuxData.sessions.length > 0) {
    // tmux mode: list tmux sessions with attached status
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
    // bunterm mode: list bunterm sessions directly
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

  return { sessions, tmuxInstalled: tmuxData.installed };
}

// === Output ===

function outputText(data: ListData, options: Pick<ListOptions, 'long' | 'url'>): void {
  if (data.sessions.length === 0) {
    console.log('No active sessions.');
    console.log('Run "bunterm up" to start a session.');
    return;
  }

  for (const session of data.sessions) {
    if (options.url && session.url) {
      console.log(session.url);
    } else if (options.long) {
      const status = session.attached ? ' (attached)' : '';
      if (session.tmux) {
        console.log(`${session.name}\t${session.dir}\t${session.tmux.windows} windows${status}`);
      } else {
        console.log(`${session.name}\t${session.dir}\t${session.path}`);
      }
    } else {
      const status = session.attached ? ' (attached)' : '';
      console.log(`${session.name}${status}`);
    }
  }
}

// === Command Entry Point ===

export async function listCommand(options: ListOptions): Promise<void> {
  const config = loadConfig(options.config);

  // Check daemon
  const guard = await guardDaemon({ json: options.json });
  if (!guard.running) {
    return;
  }

  try {
    // Fetch data
    const [buntermSessions, tmuxData] = await Promise.all([
      getSessions(config),
      getTmuxSessions(config)
    ]);

    // Transform to list
    const data = buildSessionList(buntermSessions, tmuxData, config);

    // Output (JSON or text)
    if (options.json) {
      console.log(JSON.stringify({
        sessions: data.sessions,
        daemon: true,
        tmuxInstalled: data.tmuxInstalled
      }));
    } else {
      outputText(data, options);
    }
  } catch (error) {
    throw CliError.from(error, 'Failed to list sessions');
  }
}
