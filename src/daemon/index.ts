import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { createServer as createUnixServer } from 'node:net';
import { clearDaemonState, getSocketPath, getStateDir, setDaemonState } from '@/config/state.js';
import type { Config } from '@/config/types.js';
import { createLogger } from '@/utils/logger.js';
import { captureException, initSentry } from '@/utils/sentry.js';
import { VERSION } from '@/version.js';
import { getCurrentConfig, initConfigManager, reloadConfig } from './config-manager.js';
import { type NativeTerminalServer, createNativeTerminalServer } from './native-terminal/index.js';

const log = createLogger('daemon');

export interface DaemonOptions {
  configPath?: string;
  foreground?: boolean;
}

/**
 * Clean up a socket file if it exists
 */
function cleanupSocketFile(socketPath: string, label = 'socket'): void {
  if (existsSync(socketPath)) {
    try {
      unlinkSync(socketPath);
      log.info(`Removed old ${label}: ${socketPath}`);
    } catch (err) {
      log.warn(`Failed to remove old ${label} ${socketPath}: ${err}`);
    }
  }
}


export async function startDaemon(options: DaemonOptions = {}): Promise<void> {
  log.info('Starting daemon...');

  const configManager = initConfigManager(options.configPath);
  const config = configManager.getConfig();
  log.info(`Config loaded: port=${config.daemon_port}, base_path=${config.base_path}`);

  // Initialize Sentry early (before setting up error handlers)
  await initSentry(config.sentry, VERSION);

  // Set up global error handlers (with Sentry integration)
  process.on('uncaughtException', (error) => {
    log.error(`Uncaught exception: ${error.message}`, error.stack);
    captureException(error, { type: 'uncaughtException' });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    log.error(`Unhandled rejection at: ${promise}, reason: ${reason}`);
    captureException(reason, { type: 'unhandledRejection' });
  });

  const stateDir = getStateDir();
  const socketPath = getSocketPath();

  // Ensure state directory exists
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
    log.info(`Created state directory: ${stateDir}`);
  }

  // Clean up old sockets
  cleanupSocketFile(socketPath, 'CLI socket');

  // Start native terminal daemon (Bun.serve based)
  await startNativeTerminalDaemon(config, configManager, socketPath, options);
}

/**
 * Start daemon in native terminal mode (Bun.serve based)
 */
async function startNativeTerminalDaemon(
  config: Config,
  _configManager: ReturnType<typeof initConfigManager>,
  socketPath: string,
  options: DaemonOptions
): Promise<void> {
  log.info('Starting native terminal daemon...');

  // Create native terminal server
  let nativeServer: NativeTerminalServer;
  try {
    nativeServer = createNativeTerminalServer({
      config,
      getConfig: getCurrentConfig
    });
  } catch (error) {
    log.error(`Failed to start native terminal server: ${error}`);
    throw error;
  }

  console.log(
    `bunterm daemon started on http://localhost:${config.daemon_port}${config.base_path}/`
  );
  console.log(`  Listening on: ${config.listen_addresses[0] || '127.0.0.1'}`);

  // Save daemon state
  setDaemonState({
    pid: process.pid,
    port: config.daemon_port,
    started_at: new Date().toISOString()
  });
  log.info(`Daemon state saved: pid=${process.pid}`);

  // Create Unix socket for CLI communication
  const unixServer = createUnixServer((socket) => {
    socket.on('data', (data) => {
      const command = data.toString().trim();
      log.debug(`Unix socket received command: ${command}`);
      if (command === 'ping') {
        socket.write('pong');
      } else if (
        command === 'shutdown' ||
        command === 'shutdown-with-sessions' ||
        command === 'shutdown-with-sessions-kill-tmux'
      ) {
        socket.write('ok');
        shutdownNative();
      } else if (command === 'reload') {
        const result = reloadConfig();
        socket.write(JSON.stringify(result));
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

  // Shutdown handler for native mode
  const shutdownNative = async () => {
    log.info('Shutdown requested (native mode)');
    console.log('\nShutting down...');
    await nativeServer.stop();
    clearDaemonState();
    unixServer.close();
    cleanupSocketFile(socketPath, 'CLI socket');
    log.info('Native daemon shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', () => {
    log.info('Received SIGINT');
    shutdownNative();
  });
  process.on('SIGTERM', () => {
    log.info('Received SIGTERM');
    shutdownNative();
  });

  // Keep process running
  if (!options.foreground) {
    process.stdin.unref?.();
  }
}

// Note: Auto-execution removed because compiled Bun binaries always match
// process.argv[1] === __filename. Use 'bunterm daemon -f' instead.
