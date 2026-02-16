#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { program } from 'commander';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')) as { version: string };
import { attachCommand } from './commands/attach.js';
import {
  caddyRemoveCommand,
  caddySetupCommand,
  caddySnippetCommand,
  caddyStatusCommand
} from './commands/caddy.js';
import { daemonCommand } from './commands/daemon.js';
import { downCommand } from './commands/down.js';
import { shutdownCommand } from './commands/shutdown.js';
import { startCommand } from './commands/start.js';
import { statusCommand } from './commands/status.js';
import { stopCommand } from './commands/stop.js';
import { upCommand } from './commands/up.js';

program
  .name('ttyd-mux')
  .description('ttyd session multiplexer - manage multiple ttyd+tmux sessions')
  .version(pkg.version);

// === Main commands ===

program
  .command('up')
  .description('Start ttyd+tmux session for current directory')
  .option('-n, --name <name>', 'Session name (default: directory name)')
  .option('-c, --config <path>', 'Config file path')
  .option('-a, --attach', 'Attach to tmux session after starting')
  .option('-d, --detach', 'Do not attach to tmux session (run in background)')
  .action((options) => upCommand(options));

program
  .command('down')
  .description('Stop ttyd session for current directory')
  .option('-c, --config <path>', 'Config file path')
  .action((options) => downCommand(options));

// === Session management ===

program
  .command('start [name]')
  .description('Start a predefined session')
  .option('-a, --all', 'Start all predefined sessions')
  .option('-c, --config <path>', 'Config file path')
  .action((name, options) => startCommand(name, options));

program
  .command('stop [name]')
  .description('Stop a session')
  .option('-a, --all', 'Stop all sessions')
  .option('-c, --config <path>', 'Config file path')
  .action((name, options) => stopCommand(name, options));

program
  .command('status')
  .description('Show daemon and session status')
  .option('-c, --config <path>', 'Config file path')
  .action((options) => statusCommand(options));

// === Direct access ===

program
  .command('attach [name]')
  .description('Attach to a tmux session directly')
  .option('-c, --config <path>', 'Config file path')
  .action((name, options) => attachCommand(name, options));

// === Daemon control ===

program
  .command('daemon')
  .description('Start the daemon')
  .option('-f, --foreground', 'Run in foreground')
  .option('-c, --config <path>', 'Config file path')
  .action((options) => daemonCommand(options));

program
  .command('shutdown')
  .description('Stop the daemon')
  .option('-c, --config <path>', 'Config file path')
  .action((options) => shutdownCommand(options));

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
  .requiredOption('--hostname <hostname>', 'Server hostname')
  .option('--admin-api <url>', 'Caddy Admin API URL', 'http://localhost:2019')
  .option('-c, --config <path>', 'Config file path')
  .action((options) => caddySetupCommand(options));

caddy
  .command('remove')
  .description('Remove ttyd-mux route via Caddy Admin API')
  .requiredOption('--hostname <hostname>', 'Server hostname')
  .option('--admin-api <url>', 'Caddy Admin API URL', 'http://localhost:2019')
  .option('-c, --config <path>', 'Config file path')
  .action((options) => caddyRemoveCommand(options));

caddy
  .command('status')
  .description('Show ttyd-mux routes in Caddy')
  .option('--admin-api <url>', 'Caddy Admin API URL', 'http://localhost:2019')
  .option('-c, --config <path>', 'Config file path')
  .action((options) => caddyStatusCommand(options));

// Parse arguments
program.parse();
