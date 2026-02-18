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

export async function reloadCommand(_options: ReloadOptions): Promise<void> {
  console.log('Reloading configuration...');

  try {
    const response = await sendCommand('reload');

    if (!response) {
      console.error('Error: Daemon is not running');
      console.log('  Start with: ttyd-mux daemon');
      process.exit(1);
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

    if (result.reloaded.length > 0) {
      console.log('\nReloaded settings:');
      for (const setting of result.reloaded) {
        console.log(`  ✓ ${setting}`);
      }
    }

    if (result.requiresRestart.length > 0) {
      console.log('\nSettings requiring restart (not applied):');
      for (const setting of result.requiresRestart) {
        console.log(`  ⚠ ${setting}`);
      }
      console.log('\nTo apply these changes, restart the daemon:');
      console.log('  ttyd-mux shutdown && ttyd-mux daemon');
    }

    console.log('\nConfiguration reloaded successfully.');
  } catch (error) {
    if (error instanceof Error && error.message.includes('ENOENT')) {
      console.error('Error: Daemon is not running');
      console.log('  Start with: ttyd-mux daemon');
    } else {
      console.error('Error:', error instanceof Error ? error.message : error);
    }
    process.exit(1);
  }
}
