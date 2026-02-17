import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { createServer as createUnixServer } from 'node:net';
import { loadConfig } from '../config/config.js';
import { clearDaemonState, getSocketPath, getStateDir, setDaemonState } from '../config/state.js';
import { createDaemonServer } from './server.js';
import { stopAllSessions } from './session-manager.js';

export interface DaemonOptions {
  configPath?: string;
  foreground?: boolean;
}

export async function startDaemon(options: DaemonOptions = {}): Promise<void> {
  const config = loadConfig(options.configPath);
  const socketPath = getSocketPath();

  // Ensure state directory exists
  const stateDir = getStateDir();
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }

  // Clean up old socket if exists
  if (existsSync(socketPath)) {
    try {
      unlinkSync(socketPath);
    } catch {
      // Ignore
    }
  }

  // Create HTTP servers for each listen address
  const listenAddresses = config.listen_addresses ?? ['127.0.0.1', '::1'];
  const httpServers = listenAddresses.map(() => createDaemonServer(config));

  // Start HTTP servers
  let firstServer = true;
  for (let i = 0; i < listenAddresses.length; i++) {
    const address = listenAddresses[i];
    const server = httpServers[i];
    if (!address || !server) continue;

    server.listen(config.daemon_port, address, () => {
      if (firstServer) {
        firstServer = false;
        console.log(
          `ttyd-mux daemon started on http://localhost:${config.daemon_port}${config.base_path}/`
        );
        console.log(`  Listening on: ${listenAddresses.join(', ')}`);

        // Save daemon state
        setDaemonState({
          pid: process.pid,
          port: config.daemon_port,
          started_at: new Date().toISOString()
        });
      }
    });
  }

  // Create Unix socket for CLI communication
  const unixServer = createUnixServer((socket) => {
    socket.on('data', (data) => {
      const command = data.toString().trim();
      if (command === 'ping') {
        socket.write('pong');
      } else if (command === 'shutdown') {
        socket.write('ok');
        shutdown();
      }
      socket.end();
    });
  });

  unixServer.listen(socketPath, () => {
    console.log(`Unix socket: ${socketPath}`);
  });

  // Handle shutdown signals
  const shutdown = () => {
    console.log('\nShutting down...');
    stopAllSessions();
    clearDaemonState();

    for (const server of httpServers) {
      server.close();
    }
    unixServer.close();

    // Clean up socket file
    if (existsSync(socketPath)) {
      try {
        unlinkSync(socketPath);
      } catch {
        // Ignore
      }
    }

    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep process running
  if (!options.foreground) {
    // When not in foreground, detach stdio
    process.stdin.unref?.();
  }
}

// Note: Auto-execution removed because compiled Bun binaries always match
// process.argv[1] === __filename. Use 'ttyd-mux daemon -f' instead.
