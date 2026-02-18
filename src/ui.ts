import { type Key, emitKeypressEvents } from 'node:readline';
import type { TmuxSession } from './types.js';

// ANSI escape codes
const ansi = {
  clearScreen: '\x1b[2J\x1b[H',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m'
} as const;

const pad2 = (n: number): string => String(n).padStart(2, '0');

export function formatDate(date: Date): string {
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  return `${month}/${day} ${hours}:${minutes}`;
}

export function formatSessionLine(session: TmuxSession, index: number, isSelected: boolean): string {
  const prefix = isSelected ? `${ansi.cyan}>${ansi.reset}` : ' ';
  const num = `${ansi.yellow}[${index + 1}]${ansi.reset}`;
  const name = isSelected
    ? `${ansi.cyan}${ansi.bold}${session.name}${ansi.reset}`
    : `${ansi.bold}${session.name}${ansi.reset}`;
  const windowLabel = session.windows === 1 ? 'window' : 'windows';
  const windows = `${ansi.dim}${session.windows} ${windowLabel}${ansi.reset}`;
  const created = `${ansi.dim}(${formatDate(session.created)})${ansi.reset}`;
  const attached = session.attached ? ` ${ansi.green}*attached*${ansi.reset}` : '';

  return `${prefix} ${num} ${name.padEnd(20)} ${windows}  ${created}${attached}`;
}

function renderSessions(sessions: TmuxSession[], selectedIndex: number): void {
  process.stdout.write(ansi.clearScreen);
  console.log(`${ansi.bold}tmux sessions:${ansi.reset}\n`);

  for (const [index, session] of sessions.entries()) {
    console.log(formatSessionLine(session, index, index === selectedIndex));
  }

  console.log(`\n${ansi.dim}↑↓/jk: move  1-9: quick select  Enter: attach  q: quit${ansi.reset}`);
}

export interface SelectResult {
  action: 'attach' | 'quit';
  session?: TmuxSession;
}

export type KeyAction =
  | { type: 'quit' }
  | { type: 'select'; index: number }
  | { type: 'move'; direction: 'up' | 'down' }
  | { type: 'none' };

const keyBindings: Record<string, KeyAction> = {
  q: { type: 'quit' },
  up: { type: 'move', direction: 'up' },
  k: { type: 'move', direction: 'up' },
  down: { type: 'move', direction: 'down' },
  j: { type: 'move', direction: 'down' },
  return: { type: 'select', index: -1 }
};

export function handleKeypress(
  key: { name?: string; ctrl?: boolean } | undefined,
  sessionsCount: number
): KeyAction {
  if (!key?.name) {
    return { type: 'none' };
  }

  if (key.ctrl && key.name === 'c') {
    return { type: 'quit' };
  }

  const binding = keyBindings[key.name];
  if (binding) {
    return binding;
  }

  const num = Number.parseInt(key.name, 10);
  if (num >= 1 && num <= 9 && num <= sessionsCount) {
    return { type: 'select', index: num - 1 };
  }

  return { type: 'none' };
}

export function findInitialIndex(sessions: TmuxSession[]): number {
  const attachedIndex = sessions.findIndex((s) => s.attached);
  return attachedIndex !== -1 ? attachedIndex : 0;
}

export function calculateNewIndex(
  currentIndex: number,
  direction: 'up' | 'down',
  maxIndex: number
): number {
  return direction === 'up' ? Math.max(0, currentIndex - 1) : Math.min(maxIndex, currentIndex + 1);
}

export function selectSession(sessions: TmuxSession[]): Promise<SelectResult> {
  return new Promise((resolve) => {
    if (sessions.length === 0) {
      console.log('No tmux sessions found.');
      resolve({ action: 'quit' });
      return;
    }

    let selectedIndex = findInitialIndex(sessions);

    process.stdout.write(ansi.hideCursor);
    renderSessions(sessions, selectedIndex);

    emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    const cleanupAndResolve = (result: SelectResult): void => {
      process.stdout.write(ansi.showCursor);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.removeListener('keypress', onKeypress);
      process.stdout.write(ansi.clearScreen);
      resolve(result);
    };

    const onKeypress = (_str: string, key: Key): void => {
      const action = handleKeypress(key, sessions.length);

      // biome-ignore lint/style/useDefaultSwitchClause: KeyAction union is exhaustively matched
      switch (action.type) {
        case 'quit': {
          cleanupAndResolve({ action: 'quit' });
          break;
        }
        case 'move': {
          selectedIndex = calculateNewIndex(selectedIndex, action.direction, sessions.length - 1);
          renderSessions(sessions, selectedIndex);
          break;
        }
        case 'select': {
          cleanupAndResolve({
            action: 'attach',
            session: sessions[action.index === -1 ? selectedIndex : action.index]
          });
          break;
        }
        case 'none': {
          break;
        }
      }
    };

    process.stdin.on('keypress', onKeypress);
  });
}
