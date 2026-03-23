import { expect, test } from 'bun:test';
import { ok } from '@/utils/result.js';

test('works', () => {
  expect(typeof ok).toBe('function');
});
