import { describe, expect, test } from 'bun:test';
import { attachToSession } from './terminal-attach.js';

describe('attachToSession', () => {
  test('returns non-zero exit code when socket path does not exist', async () => {
    const result = await attachToSession({ socketPath: '/tmp/nonexistent-bunterm-test.sock' });
    expect(result).toBe(1);
  }, 5000);

  test('returns exit code 1 for invalid socket path', async () => {
    const result = await attachToSession({ socketPath: '/tmp/no-such-dir/invalid.sock' });
    expect(result).toBe(1);
  }, 5000);
});

describe('attachToSession raw mode', () => {
  test('does not crash when stdin is not a TTY', async () => {
    const isTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });

    const result = await attachToSession({ socketPath: '/tmp/nonexistent-bunterm-test.sock' });
    expect(result).toBe(1);

    Object.defineProperty(process.stdin, 'isTTY', { value: isTTY, configurable: true });
  }, 5000);
});
