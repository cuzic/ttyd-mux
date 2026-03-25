/**
 * Terminal Attach — CLI WebSocket client for connecting to bunterm sessions
 *
 * Connects to a running session via WebSocket, bridges stdin/stdout
 * with the remote PTY, handling raw mode and terminal resize.
 *
 * Note: This is CLI-only code (not browser), so we use ws.onopen/onmessage
 * property handlers instead of addEventListener (which triggers the browser
 * scope.on lint rule).
 */

export interface AttachOptions {
  /** WebSocket URL (ws://localhost:7680/bunterm/session-name/ws) */
  url: string;
}

/**
 * Attach to a remote terminal session via WebSocket.
 * Returns exit code (0 = clean close, 1 = error).
 */
export async function attachToSession(options: AttachOptions): Promise<number> {
  return new Promise((resolve) => {
    const ws = new WebSocket(options.url);
    let rawModeSet = false;

    const onStdinData = (data: Buffer) => {
      if (ws.readyState === WebSocket.OPEN) {
        // Protocol: input message with base64-encoded data
        ws.send(JSON.stringify({ type: 'input', data: data.toString('base64') }));
      }
    };

    const onResize = () => {
      sendResize(ws);
    };

    ws.onopen = () => {
      // Enter raw mode so keystrokes are forwarded immediately
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
        rawModeSet = true;
      }
      process.stdin.resume();
      process.stdin.on('data', onStdinData);
      process.stdout.on('resize', onResize);

      // Send initial terminal size
      sendResize(ws);
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case 'output':
              // Output data is base64-encoded
              if (msg.data) {
                process.stdout.write(Buffer.from(msg.data, 'base64'));
              }
              break;
            case 'exit':
              // Session exited — close gracefully
              cleanup();
              resolve(typeof msg.code === 'number' ? msg.code : 0);
              ws.close();
              break;
            case 'error':
              if (msg.message) {
                process.stderr.write(`Error: ${msg.message}\n`);
              }
              break;
            case 'bell':
              // Terminal bell — write BEL character
              process.stdout.write('\x07');
              break;
            // Ignore pong, title, block*, fileChange, AI messages
          }
        } catch {
          // Not JSON — write raw
          process.stdout.write(event.data);
        }
      }
    };

    ws.onclose = () => {
      cleanup();
      resolve(0);
    };

    ws.onerror = () => {
      cleanup();
      resolve(1);
    };

    function sendResize(socket: WebSocket) {
      if (socket.readyState === WebSocket.OPEN && process.stdout.columns && process.stdout.rows) {
        socket.send(
          JSON.stringify({
            type: 'resize',
            cols: process.stdout.columns,
            rows: process.stdout.rows
          })
        );
      }
    }

    function cleanup() {
      process.stdin.removeListener('data', onStdinData);
      process.stdout.removeListener('resize', onResize);
      if (rawModeSet && process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.pause();
    }
  });
}
