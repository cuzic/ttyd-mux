import { describe, expect, test } from 'bun:test';
import {
  daemonNotRunning,
  formatCliError,
  renderCliError,
  sessionNotFound,
  toCliExitCode,
  toHttpStatus,
  tmuxNotInstalled,
  configNotFound,
  sessionInvalidName,
  pathTraversal
} from './errors.js';

describe('toCliExitCode', () => {
  test('not found errors return exit code 4', () => {
    expect(toCliExitCode(sessionNotFound('test'))).toBe(4);
    expect(toCliExitCode(configNotFound('/path'))).toBe(4);
  });

  test('bad input errors return exit code 2', () => {
    expect(toCliExitCode(sessionInvalidName('test', 'bad'))).toBe(2);
  });

  test('permission denied returns exit code 5', () => {
    expect(toCliExitCode(pathTraversal('/etc/passwd'))).toBe(5);
  });

  test('external dependency unavailable returns exit code 3', () => {
    expect(toCliExitCode(daemonNotRunning())).toBe(3);
    expect(toCliExitCode(tmuxNotInstalled())).toBe(3);
  });
});

describe('toHttpStatus', () => {
  test('not found errors return 404', () => {
    expect(toHttpStatus(sessionNotFound('test'))).toBe(404);
    expect(toHttpStatus(configNotFound('/path'))).toBe(404);
  });

  test('bad input errors return 400', () => {
    expect(toHttpStatus(sessionInvalidName('test', 'bad'))).toBe(400);
  });

  test('permission denied returns 403', () => {
    expect(toHttpStatus(pathTraversal('/etc/passwd'))).toBe(403);
  });

  test('daemon not running returns 503', () => {
    expect(toHttpStatus(daemonNotRunning())).toBe(503);
    expect(toHttpStatus(tmuxNotInstalled())).toBe(503);
  });
});

describe('renderCliError', () => {
  test('daemon not running includes hint', () => {
    const rendered = renderCliError(daemonNotRunning());
    expect(rendered.message).toBe('Daemon is not running');
    expect(rendered.hint).toContain('bunterm up');
  });

  test('session not found includes hint', () => {
    const rendered = renderCliError(sessionNotFound('test'));
    expect(rendered.message).toBe("Session 'test' not found");
    expect(rendered.hint).toContain('bunterm list');
  });

  test('tmux not installed includes hint', () => {
    const rendered = renderCliError(tmuxNotInstalled());
    expect(rendered.hint).toContain('Install tmux');
  });

  test('path traversal has no hint', () => {
    const rendered = renderCliError(pathTraversal('/etc/passwd'));
    expect(rendered.hint).toBeUndefined();
  });
});

describe('formatCliError', () => {
  test('includes message and hint', () => {
    const formatted = formatCliError(daemonNotRunning());
    expect(formatted).toContain('Daemon is not running');
    expect(formatted).toContain('bunterm up');
  });

  test('only message when no hint', () => {
    const formatted = formatCliError(pathTraversal('/etc/passwd'));
    expect(formatted).not.toContain('\n');
  });
});
