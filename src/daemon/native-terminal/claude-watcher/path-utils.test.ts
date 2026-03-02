/**
 * Path Utils Tests
 *
 * Tests for Claude Code session path conversion utilities.
 */

import { describe, expect, test } from 'bun:test';
import {
  cwdToProjectPath,
  getHistoryFilePath,
  getProjectDir,
  getSessionFilePath
} from './path-utils.js';

describe('cwdToProjectPath', () => {
  test('should convert absolute path to project path', () => {
    expect(cwdToProjectPath('/home/cuzic/ttyd-mux')).toBe('-home-cuzic-ttyd-mux');
  });

  test('should handle root path', () => {
    expect(cwdToProjectPath('/')).toBe('-');
  });

  test('should handle path with multiple slashes', () => {
    expect(cwdToProjectPath('/a/b/c/d/e')).toBe('-a-b-c-d-e');
  });

  test('should handle path with special characters', () => {
    expect(cwdToProjectPath('/home/user/my-project')).toBe('-home-user-my-project');
  });
});

describe('getProjectDir', () => {
  test('should return correct project directory', () => {
    const result = getProjectDir('-home-cuzic-ttyd-mux', '/home/user/.claude');
    expect(result).toBe('/home/user/.claude/projects/-home-cuzic-ttyd-mux');
  });
});

describe('getSessionFilePath', () => {
  test('should return correct session file path', () => {
    const result = getSessionFilePath(
      '-home-cuzic-ttyd-mux',
      '4385c594-2e1f-4350-aef7-96ba9d44ba54',
      '/home/user/.claude'
    );
    expect(result).toBe(
      '/home/user/.claude/projects/-home-cuzic-ttyd-mux/4385c594-2e1f-4350-aef7-96ba9d44ba54.jsonl'
    );
  });
});

describe('getHistoryFilePath', () => {
  test('should return correct history file path', () => {
    const result = getHistoryFilePath('/home/user/.claude');
    expect(result).toBe('/home/user/.claude/history.jsonl');
  });
});
