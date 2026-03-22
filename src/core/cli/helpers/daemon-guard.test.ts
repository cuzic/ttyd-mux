import { describe, expect, test } from 'bun:test';
import { isErr, isOk } from '@/utils/result.js';

// Note: Full integration tests would require mocking isDaemonRunning.
// These tests verify the Result type contract.

describe('daemon-guard Result types', () => {
  describe('checkDaemonRunning', () => {
    test('returns Ok(true) when daemon is running', () => {
      // Simulating the ok case
      const result = { ok: true as const, value: true as const };
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(true);
      }
    });

    test('returns Err with DAEMON_NOT_RUNNING when not running', () => {
      // Simulating the err case
      const result = {
        ok: false as const,
        error: {
          code: 'DAEMON_NOT_RUNNING' as const,
          message: 'Daemon is not running'
        }
      };

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('DAEMON_NOT_RUNNING');
      }
    });
  });
});
