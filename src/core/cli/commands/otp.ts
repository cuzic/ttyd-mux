/**
 * OTP command - Generate a 6-digit OTP for browser authentication
 */

import { type OtpOptions, OtpOptionsSchema, parseCliOptions } from '@/core/cli/schemas.js';
import { getDaemonConnection } from '@/core/client/daemon-url.js';
import { createClient } from '@/core/client/eden-client.js';
import { ensureDaemon } from '@/core/client/index.js';
import { loadConfig } from '@/core/config/config.js';
import { CliError } from '@/utils/errors.js';

export type { OtpOptions };

export async function otpCommand(rawOptions: unknown): Promise<void> {
  const options = parseCliOptions(rawOptions, OtpOptionsSchema, 'otp');
  const config = loadConfig(options.config);

  if (!config.security.auth_enabled) {
    throw new CliError(
      'Authentication is not enabled. Set security.auth_enabled: true in config.yaml'
    );
  }

  // Ensure daemon is running
  await ensureDaemon(options.config, config.daemon_manager);

  const client = createClient(getDaemonConnection(config));
  const { data, error } = await client.api.auth.otp.generate.post(
    {},
    {
      query: options.ttl ? { ttl: String(options.ttl) } : undefined
    }
  );

  if (error || !data) {
    throw new CliError(`Failed to generate OTP: ${error?.value ?? 'Unknown error'}`);
  }

  const result = data;
  const ttl = result.ttlSeconds;

  // Display OTP prominently
  console.log('');
  console.log('  ┌─────────────────────────────┐');
  console.log('  │                             │');
  console.log(`  │     OTP:  ${result.code}          │`);
  console.log('  │                             │');
  console.log('  └─────────────────────────────┘');
  console.log('');
  console.log(`  Valid for ${ttl} seconds`);
  console.log('  Enter this code in the browser to authenticate.');
  console.log('');
}
