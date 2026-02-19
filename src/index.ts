#!/usr/bin/env node

import { program } from 'commander';
import { attachCommand } from './commands/attach.js';
import {
  caddyRemoveCommand,
  caddySetupCommand,
  caddySnippetCommand,
  caddyStatusCommand,
  caddySyncCommand
} from './commands/caddy.js';
import { daemonCommand } from './commands/daemon.js';
import { deployCommand } from './commands/deploy.js';
import { doctorCommand } from './commands/doctor.js';
import { downCommand } from './commands/down.js';
import { reloadCommand } from './commands/reload.js';
import { restartCommand } from './commands/restart.js';
import { shutdownCommand } from './commands/shutdown.js';
import { statusCommand } from './commands/status.js';
import { upCommand } from './commands/up.js';
import { NAME, VERSION } from './version.js';

program
  .name(NAME)
  .description('ttyd session multiplexer - manage multiple ttyd+tmux sessions')
  .version(VERSION);

// === Session commands ===

program
  .command('up [name]')
  .description('Start a ttyd+tmux session')
  .option('-n, --name <name>', 'Session name (for current directory)')
  .option('-c, --config <path>', 'Config file path')
  .option('-a, --attach', 'Attach to tmux session after starting')
  .option('-d, --detach', 'Do not attach to tmux session')
  .option('--all', 'Start all predefined sessions')
  .action((name, options) => upCommand(name, options));

program
  .command('down [name]')
  .description('Stop a ttyd session')
  .option('-c, --config <path>', 'Config file path')
  .option('--all', 'Stop all sessions')
  .action((name, options) => downCommand(name, options));

program
  .command('status')
  .description('Show daemon and session status')
  .option('-c, --config <path>', 'Config file path')
  .action((options) => statusCommand(options));

program
  .command('attach [name]')
  .description('Attach to a tmux session directly')
  .option('-c, --config <path>', 'Config file path')
  .action((name, options) => attachCommand(name, options));

// === Daemon control ===

const daemon = program.command('daemon').description('Daemon management');

daemon
  .command('start')
  .description('Start the daemon')
  .option('-f, --foreground', 'Run in foreground')
  .option('-c, --config <path>', 'Config file path')
  .action((options) => daemonCommand(options));

daemon
  .command('stop')
  .description('Stop the daemon')
  .option('-c, --config <path>', 'Config file path')
  .option('-s, --stop-sessions', 'Stop all sessions before shutting down')
  .action((options) => shutdownCommand(options));

daemon
  .command('reload')
  .description('Reload configuration without restart')
  .option('-c, --config <path>', 'Config file path')
  .action((options) => reloadCommand(options));

daemon
  .command('restart')
  .description('Restart the daemon (stop and start)')
  .option('-c, --config <path>', 'Config file path')
  .action((options) => restartCommand(options));

// === Utilities ===

program
  .command('doctor')
  .description('Check dependencies and configuration')
  .option('-c, --config <path>', 'Config file path')
  .action((options) => doctorCommand(options));

program
  .command('deploy')
  .description('Generate static files for static mode deployment')
  .option('--hostname <hostname>', 'Server hostname (or set in config.yaml)')
  .option('-o, --output <dir>', 'Output directory')
  .option('-c, --config <path>', 'Config file path')
  .action((options) => deployCommand(options));

// === Caddy integration ===

const caddy = program.command('caddy').description('Caddy reverse proxy integration');

caddy
  .command('snippet')
  .description('Show Caddyfile snippet for copy-paste')
  .option('-c, --config <path>', 'Config file path')
  .action((options) => caddySnippetCommand(options));

caddy
  .command('setup')
  .description('Add ttyd-mux route via Caddy Admin API')
  .option('--hostname <hostname>', 'Server hostname (or set in config.yaml)')
  .option('--admin-api <url>', 'Caddy Admin API URL')
  .option('-c, --config <path>', 'Config file path')
  .action((options) => caddySetupCommand(options));

caddy
  .command('remove')
  .description('Remove ttyd-mux route via Caddy Admin API')
  .option('--hostname <hostname>', 'Server hostname (or set in config.yaml)')
  .option('--admin-api <url>', 'Caddy Admin API URL')
  .option('-c, --config <path>', 'Config file path')
  .action((options) => caddyRemoveCommand(options));

caddy
  .command('sync')
  .description('Sync session routes with Caddy (static mode only)')
  .option('--hostname <hostname>', 'Server hostname (or set in config.yaml)')
  .option('--admin-api <url>', 'Caddy Admin API URL')
  .option('-c, --config <path>', 'Config file path')
  .action((options) => caddySyncCommand(options));

caddy
  .command('status')
  .description('Show ttyd-mux routes in Caddy')
  .option('--admin-api <url>', 'Caddy Admin API URL')
  .option('-c, --config <path>', 'Config file path')
  .action((options) => caddyStatusCommand(options));

// Parse arguments
program.parse();
