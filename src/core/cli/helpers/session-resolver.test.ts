import { describe, expect, test } from 'bun:test';

// Note: These are placeholder tests. Full integration tests would
// require mocking the API client (getSessions).

describe('session-resolver', () => {
  describe('requireSessionByName', () => {
    test('exports function', async () => {
      const { requireSessionByName } = await import('./session-resolver.js');
      expect(typeof requireSessionByName).toBe('function');
    });
  });

  describe('requireSessionForCwd', () => {
    test('exports function', async () => {
      const { requireSessionForCwd } = await import('./session-resolver.js');
      expect(typeof requireSessionForCwd).toBe('function');
    });
  });
});
