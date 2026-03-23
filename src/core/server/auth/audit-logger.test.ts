import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type AuditEvent, AuditLogger } from './audit-logger.js';

describe('AuditLogger', () => {
  let tempDir: string;
  let logPath: string;

  beforeEach(() => {
    tempDir = join(
      tmpdir(),
      `audit-logger-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    mkdirSync(tempDir, { recursive: true });
    logPath = join(tempDir, 'audit.log');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test('writes audit event as JSON Lines', async () => {
    const logger = new AuditLogger(logPath);

    const event: AuditEvent = {
      type: 'auth_success',
      remoteAddr: '192.168.1.1',
      sessionName: 'main',
      user: 'alice'
    };

    await logger.log(event);
    await logger.dispose();

    const content = (await Bun.file(logPath).text()).trim();
    const parsed = JSON.parse(content);

    expect(parsed.type).toBe('auth_success');
    expect(parsed.remoteAddr).toBe('192.168.1.1');
    expect(parsed.sessionName).toBe('main');
    expect(parsed.user).toBe('alice');
    expect(parsed.timestamp).toBeDefined();
    // timestamp should be ISO 8601
    expect(() => new Date(parsed.timestamp)).not.toThrow();
  });

  test('writes multiple events as separate JSON lines', async () => {
    const logger = new AuditLogger(logPath);

    await logger.log({
      type: 'auth_success',
      remoteAddr: '10.0.0.1'
    });
    await logger.log({
      type: 'ws_connect',
      remoteAddr: '10.0.0.2',
      sessionName: 'dev'
    });
    await logger.log({
      type: 'auth_failure',
      remoteAddr: '10.0.0.3',
      details: 'invalid token'
    });

    await logger.dispose();

    const lines = (await Bun.file(logPath).text()).trim().split('\n');
    expect(lines.length).toBe(3);

    // Each line should be valid JSON
    const events = lines.map((line) => JSON.parse(line));
    expect(events[0].type).toBe('auth_success');
    expect(events[1].type).toBe('ws_connect');
    expect(events[1].sessionName).toBe('dev');
    expect(events[2].type).toBe('auth_failure');
    expect(events[2].details).toBe('invalid token');
  });

  test('creates log file with correct permissions', async () => {
    const logger = new AuditLogger(logPath);

    await logger.log({
      type: 'session_create',
      remoteAddr: '127.0.0.1',
      sessionName: 'test'
    });
    await logger.dispose();

    expect(existsSync(logPath)).toBe(true);

    // Check file permissions (0600 = owner read/write only)
    const { statSync } = await import('node:fs');
    const stats = statSync(logPath);
    const mode = stats.mode & 0o777;
    expect(mode).toBe(0o600);
  });

  test('dispose flushes pending writes', async () => {
    const logger = new AuditLogger(logPath);

    await logger.log({
      type: 'session_end',
      remoteAddr: '::1',
      sessionName: 'mySession'
    });

    await logger.dispose();

    const content = (await Bun.file(logPath).text()).trim();
    const parsed = JSON.parse(content);
    expect(parsed.type).toBe('session_end');
    expect(parsed.sessionName).toBe('mySession');
  });

  test('omits optional fields when not provided', async () => {
    const logger = new AuditLogger(logPath);

    await logger.log({
      type: 'otp_attempt',
      remoteAddr: '192.168.0.1'
    });
    await logger.dispose();

    const content = (await Bun.file(logPath).text()).trim();
    const parsed = JSON.parse(content);

    expect(parsed.type).toBe('otp_attempt');
    expect(parsed.remoteAddr).toBe('192.168.0.1');
    expect(parsed.sessionName).toBeUndefined();
    expect(parsed.user).toBeUndefined();
    expect(parsed.details).toBeUndefined();
  });

  test('creates parent directories if they do not exist', async () => {
    const nestedPath = join(tempDir, 'nested', 'dir', 'audit.log');
    const logger = new AuditLogger(nestedPath);

    await logger.log({
      type: 'ws_disconnect',
      remoteAddr: '10.0.0.5'
    });
    await logger.dispose();

    expect(existsSync(nestedPath)).toBe(true);
    const content = (await Bun.file(nestedPath).text()).trim();
    const parsed = JSON.parse(content);
    expect(parsed.type).toBe('ws_disconnect');
  });
});
