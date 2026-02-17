import { spawn } from 'node:child_process';
import { getSessions, isDaemonRunning } from '@/client/index.js';
import { loadConfig } from '@/config/config.js';
import type { SessionResponse } from '@/config/types.js';

export interface AttachOptions {
  config?: string;
}

export async function attachCommand(
  name: string | undefined,
  options: AttachOptions
): Promise<void> {
  // If no name provided, show selection UI
  if (!name) {
    await interactiveAttach(options);
    return;
  }

  // Attach to named session
  await attachToSession(name);
}

async function interactiveAttach(_options: AttachOptions): Promise<void> {
  // Check if daemon is running to get session list
  const running = await isDaemonRunning();

  let sessions: SessionResponse[] = [];
  if (running) {
    try {
      sessions = await getSessions(loadConfig(_options.config));
    } catch {
      // Ignore errors
    }
  }

  // Also get tmux sessions directly
  const tmuxSessions = await getTmuxSessions();

  // Merge session lists (prefer daemon info)
  const allSessions = new Map<string, string>();
  for (const session of sessions) {
    allSessions.set(session.name, session.dir);
  }
  for (const name of tmuxSessions) {
    if (!allSessions.has(name)) {
      allSessions.set(name, '');
    }
  }

  if (allSessions.size === 0) {
    console.log('No tmux sessions available.');
    console.log('Start one with: ttyd-mux up');
    return;
  }

  // Simple selection UI
  const sessionList = Array.from(allSessions.entries());
  console.log('Available sessions:');
  sessionList.forEach(([name, dir], index) => {
    const dirInfo = dir ? ` (${dir})` : '';
    console.log(`  ${index + 1}. ${name}${dirInfo}`);
  });

  // Read user input
  const readline = await import('node:readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('\nSelect session (number or name): ', async (answer) => {
    rl.close();

    const num = Number.parseInt(answer, 10);
    let sessionName: string;

    if (!Number.isNaN(num) && num >= 1 && num <= sessionList.length) {
      const entry = sessionList[num - 1];
      sessionName = entry ? entry[0] : answer.trim();
    } else {
      sessionName = answer.trim();
    }

    if (!sessionName) {
      console.log('Cancelled.');
      return;
    }

    await attachToSession(sessionName);
  });
}

async function attachToSession(name: string): Promise<void> {
  // Check if inside tmux
  const insideTmux = !!process.env['TMUX'];

  const args = insideTmux ? ['switch-client', '-t', name] : ['attach-session', '-t', name];

  const tmux = spawn('tmux', args, {
    stdio: 'inherit'
  });

  tmux.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

async function getTmuxSessions(): Promise<string[]> {
  const { execSync } = await import('node:child_process');

  try {
    const output = execSync('tmux list-sessions -F "#{session_name}"', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return output
      .trim()
      .split('\n')
      .filter((s) => s.length > 0);
  } catch {
    return [];
  }
}
