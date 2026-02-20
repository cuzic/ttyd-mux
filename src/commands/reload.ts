/**
 * Reload command - Reload daemon configuration
 */

import { sendCommand } from '@/client/daemon-client.js';

export interface ReloadOptions {
  config?: string;
}

export interface ReloadResult {
  success: boolean;
  reloaded: string[];
  requiresRestart: string[];
  error?: string;
}

function printDaemonNotRunning(): never {
  console.error('Error: Daemon is not running');
  console.log('  Start with: ttyd-mux daemon start');
  process.exit(1);
}

function printReloadedSettings(reloaded: string[]): void {
  if (reloaded.length === 0) {
    return;
  }
  console.log('\nReloaded settings:');
  for (const setting of reloaded) {
    console.log(`  ✓ ${setting}`);
  }
}

function printRestartRequired(requiresRestart: string[]): void {
  if (requiresRestart.length === 0) {
    return;
  }
  console.log('\nSettings requiring restart (not applied):');
  for (const setting of requiresRestart) {
    console.log(`  ⚠ ${setting}`);
  }
  console.log('\nTo apply these changes, restart the daemon:');
  console.log('  ttyd-mux daemon restart');
}

export async function reloadCommand(_options: ReloadOptions): Promise<void> {
  console.log('Reloading configuration...');

  try {
    const response = await sendCommand('reload');

    if (!response) {
      printDaemonNotRunning();
    }

    const result: ReloadResult = JSON.parse(response);

    if (!result.success) {
      console.error(`Error: ${result.error}`);
      process.exit(1);
    }

    if (result.reloaded.length === 0 && result.requiresRestart.length === 0) {
      console.log('No configuration changes detected.');
      return;
    }

    printReloadedSettings(result.reloaded);
    printRestartRequired(result.requiresRestart);

    console.log('\nConfiguration reloaded successfully.');
  } catch (error) {
    if (error instanceof Error && error.message.includes('ENOENT')) {
      printDaemonNotRunning();
    }
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
