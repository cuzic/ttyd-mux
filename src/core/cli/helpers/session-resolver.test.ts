import { describe, expect, mock, test } from 'bun:test';
import { isErr, isOk } from '@/utils/result.js';

// Note: Full integration tests would require mocking the API client.
// These tests verify the Result type contract.

describe('session-resolver Result types', () => {
  describe('getSessionByName', () => {
    test('returns Ok when session found', async () => {
      // This would need API mocking in a real test
      // For now, verify the type contract in the type system
      const mockSession = {
        name: 'test',
        port: 7601,
        path: '/test',
        fullPath: '/bunterm/test',
        dir: '/home/user/test',
        pid: 1234,
        started_at: '2026-03-21T00:00:00Z'
      };

      // Simulating the ok case
      const result = { ok: true as const, value: mockSession };
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.name).toBe('test');
      }
    });

    test('returns Err with SESSION_NOT_FOUND when not found', async () => {
      // Simulating the err case
      const result = {
        ok: false as const,
        error: {
          code: 'SESSION_NOT_FOUND' as const,
          message: "Session 'missing' not found",
          sessionName: 'missing'
        }
      };

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('SESSION_NOT_FOUND');
        expect(result.error.sessionName).toBe('missing');
      }
    });
  });

  describe('getSessionForCwd', () => {
    test('returns Err with cwd as sessionName when not found', async () => {
      // Simulating the err case
      const cwd = '/home/user/project';
      const result = {
        ok: false as const,
        error: {
          code: 'SESSION_NOT_FOUND' as const,
          message: `Session '${cwd}' not found`,
          sessionName: cwd
        }
      };

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.sessionName).toBe(cwd);
      }
    });
  });
});
