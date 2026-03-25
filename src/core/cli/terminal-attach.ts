/**
 * Terminal Attach — CLI client for connecting to bunterm sessions via Unix socket
 *
 * Connects to a running session via Unix domain socket, bridges stdin/stdout
 * with the remote PTY using a binary relay protocol (no JSON, no base64).
 */

import { access } from 'node:fs/promises';
import { createConnection, type Socket } from 'node:net';

import { filterDAResponses, filterFocusEvents } from '@/core/terminal/da-responder.js';
import { createResizeMessage, parseControlMessage } from '@/utils/socket-relay.js';

export interface AttachOptions {
  /** Unix socket path (e.g. ~/.local/state/bunterm/sessions/{name}.sock) */
  socketPath: string;
}

/**
 * Attach to a remote terminal session via Unix socket.
 * Returns exit code (0 = clean close, 1 = error).
 */
export async function attachToSession(options: AttachOptions): Promise<number> {
  // Check socket exists before attempting connection
  try {
    await access(options.socketPath);
  } catch {
    process.stderr.write(`Error: Socket not found: ${options.socketPath}\n`);
    return 1;
  }

  return new Promise((resolve) => {
    let rawModeSet = false;
    let resolved = false;

    const resolveOnce = (code: number) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(code);
    };

    const socket: Socket = createConnection(options.socketPath);

    const onStdinData = (data: Buffer) => {
      if (socket.destroyed) return;

      // Filter DA responses and focus events from outer terminal
      let text = data.toString('utf-8');
      text = filterDAResponses(text) ?? '';
      text = filterFocusEvents(text) ?? '';
      if (!text) return;

      socket.write(Buffer.from(text, 'utf-8'));
    };

    const onResize = () => {
      if (socket.destroyed) return;
      if (process.stdout.columns && process.stdout.rows) {
        socket.write(createResizeMessage(process.stdout.columns, process.stdout.rows));
      }
    };

    socket.on('connect', () => {
      // Enter raw mode so keystrokes are forwarded immediately
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
        rawModeSet = true;
      }
      process.stdin.resume();
      process.stdin.on('data', onStdinData);
      process.stdout.on('resize', onResize);

      // Send initial terminal size
      onResize();
    });

    socket.on('data', (data: Buffer) => {
      // Check for control messages (e.g. exit notification from server)
      const ctrl = parseControlMessage(data);
      if (ctrl) {
        // Control messages from server (resize ack etc.) — ignore on client side
        return;
      }
      // Raw PTY output — write directly to stdout
      process.stdout.write(data);
    });

    socket.on('error', () => {
      resolveOnce(1);
    });

    socket.on('close', () => {
      resolveOnce(0);
    });

    function cleanup() {
      process.stdin.removeListener('data', onStdinData);
      process.stdout.removeListener('resize', onResize);
      if (rawModeSet && process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.pause();
      if (!socket.destroyed) {
        socket.destroy();
      }
    }
  });
}
