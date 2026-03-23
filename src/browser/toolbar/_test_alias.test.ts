import { expect, test } from 'bun:test';
import { Scope } from '@/browser/shared/lifecycle.js';

test('works', () => {
  expect(typeof Scope).toBe('function');
});
