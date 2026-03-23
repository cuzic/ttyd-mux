import { describe, expect, test } from 'bun:test';

import { extractSessionFromPagePath, extractSessionFromWsPath } from './path-utils.js';

describe('extractSessionFromPagePath', () => {
  const basePath = '/bunterm';

  test('extracts session name from page path', () => {
    expect(extractSessionFromPagePath('/bunterm/my-session', basePath)).toBe('my-session');
  });

  test('extracts session name with trailing slash', () => {
    expect(extractSessionFromPagePath('/bunterm/my-session/', basePath)).toBe('my-session');
  });

  test('returns null for portal path (no session segment)', () => {
    expect(extractSessionFromPagePath('/bunterm', basePath)).toBeNull();
    expect(extractSessionFromPagePath('/bunterm/', basePath)).toBeNull();
  });

  test('returns null for paths with sub-segments', () => {
    expect(extractSessionFromPagePath('/bunterm/session/extra', basePath)).toBeNull();
  });

  test('returns null for non-matching prefix', () => {
    expect(extractSessionFromPagePath('/other/session', basePath)).toBeNull();
  });

  test('works with root basePath', () => {
    expect(extractSessionFromPagePath('/my-session', '')).toBe('my-session');
    expect(extractSessionFromPagePath('/', '')).toBeNull();
  });
});

describe('extractSessionFromWsPath', () => {
  const basePath = '/bunterm';

  test('extracts session name from ws path', () => {
    expect(extractSessionFromWsPath('/bunterm/my-session/ws', basePath)).toBe('my-session');
  });

  test('returns null without /ws suffix', () => {
    expect(extractSessionFromWsPath('/bunterm/my-session', basePath)).toBeNull();
  });

  test('returns null for non-matching prefix', () => {
    expect(extractSessionFromWsPath('/other/my-session/ws', basePath)).toBeNull();
  });

  test('returns null for bare /ws path (no session)', () => {
    expect(extractSessionFromWsPath('/bunterm/ws', basePath)).toBeNull();
  });

  test('works with root basePath', () => {
    expect(extractSessionFromWsPath('/my-session/ws', '')).toBe('my-session');
  });
});
