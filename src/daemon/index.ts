import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { createServer as createUnixServer } from 'node:net';
import { loadConfig } from '@/config/config.js';
import { clearDaemonState, getSocketPath, getStateDir, setDaemonState } from '@/config/state.js';
import { createLogger } from '@/utils/logger.js';
import { createDaemonServer } from './server.js';
import { sessionManager } from './session-manager.js';

const log = createLogger('daemon');

export interface DaemonOptions {
  configPath?: string;
  foreground?: boolean;
}

/**
 * Revalidate existing sessions from previous daemon instance
 */
function revalidateExistingSessions(): void {
  const { valid, removed } = sessionManager.revalidateSessions();
  if (valid.length === 0 && removed.length === 0) {
    return;
  }
  log.info(`Session revalidation: ${valid.length} active, ${removed.length} removed`);
  if (valid.length > 0) {
    console.log(`Recovered ${valid.length} existing session(s)`);
  }
  if (removed.length > 0) {
    console.log(`Cleaned up ${removed.length} dead session(s)`);
  }
}

export async function startDaemon(options: DaemonOptions = {}): Promise<void> {
  log.info('Starting daemon...');

  revalidateExistingSessions();

  // Set up global error handlers
  process.on('uncaughtException', (error) => {
    log.error(`Uncaught exception: ${error.message}`, error.stack);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    log.error(`Unhandled rejection at: ${promise}, reason: ${reason}`);
  });

  const config = loadConfig(options.configPath);
  log.info(`Config loaded: port=${config.daemon_port}, base_path=${config.base_path}`);

  const socketPath = getSocketPath();

  // Ensure state directory exists
  const stateDir = getStateDir();
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
    log.info(`Created state directory: ${stateDir}`);
  }

  // Clean up old socket if exists
  if (existsSync(socketPath)) {
    try {
      unlinkSync(socketPath);
      log.info(`Removed old socket: ${socketPath}`);
    } catch (err) {
      log.warn(`Failed to remove old socket: ${err}`);
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
    if (!(address && server)) {
      continue;
    }

    server.on('error', (err) => {
      log.error(`HTTP server error on ${address}: ${err.message}`, err.stack);
    });

    server.listen(config.daemon_port, address, () => {
      log.info(`HTTP server listening on ${address}:${config.daemon_port}`);
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
        log.info(`Daemon state saved: pid=${process.pid}`);
      }
    });
  }

  // Create Unix socket for CLI communication
  const unixServer = createUnixServer((socket) => {
    socket.on('data', (data) => {
      const command = data.toString().trim();
      log.debug(`Unix socket received command: ${command}`);
      if (command === 'ping') {
        socket.write('pong');
      } else if (command === 'shutdown') {
        socket.write('ok');
        shutdown(false);
      } else if (command === 'shutdown-with-sessions') {
        socket.write('ok');
        shutdown(true);
      }
      socket.end();
    });
    socket.on('error', (err) => {
      log.error(`Unix socket connection error: ${err.message}`);
    });
  });

  unixServer.on('error', (err) => {
    log.error(`Unix server error: ${err.message}`, err.stack);
  });

  unixServer.listen(socketPath, () => {
    log.info(`Unix socket listening: ${socketPath}`);
    console.log(`Unix socket: ${socketPath}`);
  });

  // Handle shutdown signals
  const shutdown = (stopSessions = false) => {
    log.info(`Shutdown requested (stopSessions=${stopSessions})`);
    console.log('\nShutting down...');
    if (stopSessions) {
      sessionManager.stopAllSessions();
      log.info('All sessions stopped');
    } else {
      log.info('Sessions preserved (daemon-only shutdown)');
    }
    clearDaemonState();
    log.info('Daemon state cleared');

    for (const server of httpServers) {
      server.close();
    }
    unixServer.close();
    log.info('Servers closed');

    // Clean up socket file
    if (existsSync(socketPath)) {
      try {
        unlinkSync(socketPath);
        log.info(`Socket file removed: ${socketPath}`);
      } catch (err) {
        log.warn(`Failed to remove socket file: ${err}`);
      }
    }

    log.info('Daemon shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', () => {
    log.info('Received SIGINT');
    shutdown();
  });
  process.on('SIGTERM', () => {
    log.info('Received SIGTERM');
    shutdown();
  });

  // Keep process running
  if (!options.foreground) {
    // When not in foreground, detach stdio
    process.stdin.unref?.();
  }
}

// Note: Auto-execution removed because compiled Bun binaries always match
// process.argv[1] === __filename. Use 'ttyd-mux daemon -f' instead.
