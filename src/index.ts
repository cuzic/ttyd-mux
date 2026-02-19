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
  .version(VERSION)
  .addHelpText(
    'after',
    `
Usage Patterns:

  Dynamic (ad-hoc sessions):
    $ cd ~/my-project && ttyd-mux up    # Start session for current directory
    $ ttyd-mux down                     # Stop it

  Static (predefined sessions in config.yaml):
    $ ttyd-mux up --all                 # Start all predefined sessions
    $ ttyd-mux down --all               # Stop all sessions
`
  );

// === Session commands ===

program
  .command('up [name]')
  .description('Start session (current dir, or named/all from config)')
  .option('-n, --name <name>', 'Override session name')
  .option('-c, --config <path>', 'Config file path')
  .option('-a, --attach', 'Attach to tmux session after starting')
  .option('-d, --detach', 'Do not attach to tmux session')
  .option('--all', 'Start all sessions defined in config.yaml')
  .action((name, options) => upCommand(name, options));

program
  .command('down [name]')
  .description('Stop session (current dir, or named/all)')
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
  .description('Restart the daemon (apply code updates)')
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
  .description('Generate static files for static proxy mode')
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
  .description('Sync session routes with Caddy (static proxy mode)')
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
