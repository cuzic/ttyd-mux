/**
 * FileWatcher Tests
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileWatcher } from './file-watcher.js';

describe('FileWatcher', () => {
  let testDir: string;
  let watcher: FileWatcher;
  let onChangeMock: ReturnType<typeof mock>;

  beforeEach(() => {
    // Create a temporary directory for tests
    testDir = join(tmpdir(), `file-watcher-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    onChangeMock = mock((_path: string) => {});
    watcher = new FileWatcher(testDir, onChangeMock, { debounceMs: 50 });
  });

  afterEach(() => {
    watcher.close();
    // Clean up test directory
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test('watchFile - should watch a single file', async () => {
    const filePath = join(testDir, 'test.txt');
    writeFileSync(filePath, 'initial content');

    watcher.watchFile('test.txt');

    expect(watcher.isWatchingFile('test.txt')).toBe(true);
    expect(watcher.watcherCount).toBe(1);
  });

  test('watchFile - should trigger onChange when file changes', async () => {
    const filePath = join(testDir, 'test.txt');
    writeFileSync(filePath, 'initial content');

    watcher.watchFile('test.txt');

    // Modify the file
    await Bun.sleep(100);
    writeFileSync(filePath, 'modified content');

    // Wait for debounce
    await Bun.sleep(200);

    expect(onChangeMock).toHaveBeenCalledWith('test.txt');
  });

  test('unwatchFile - should stop watching a file', () => {
    const filePath = join(testDir, 'test.txt');
    writeFileSync(filePath, 'content');

    watcher.watchFile('test.txt');
    expect(watcher.isWatchingFile('test.txt')).toBe(true);

    watcher.unwatchFile('test.txt');
    expect(watcher.isWatchingFile('test.txt')).toBe(false);
    expect(watcher.watcherCount).toBe(0);
  });

  test('watchFile - should not create duplicate watchers', () => {
    const filePath = join(testDir, 'test.txt');
    writeFileSync(filePath, 'content');

    watcher.watchFile('test.txt');
    watcher.watchFile('test.txt');

    expect(watcher.watcherCount).toBe(1);
  });

  test('watchDir - should watch a directory recursively', async () => {
    const subDir = join(testDir, 'subdir');
    mkdirSync(subDir, { recursive: true });
    writeFileSync(join(subDir, 'file.txt'), 'content');

    watcher.watchDir('subdir');

    expect(watcher.isWatchingDir('subdir')).toBe(true);
    expect(watcher.watcherCount).toBe(1);
  });

  test('watchDir - should trigger onChange for nested file changes', async () => {
    const subDir = join(testDir, 'subdir');
    mkdirSync(subDir, { recursive: true });
    const nestedFile = join(subDir, 'nested.txt');
    writeFileSync(nestedFile, 'initial');

    watcher.watchDir('subdir');

    // Modify nested file
    await Bun.sleep(100);
    writeFileSync(nestedFile, 'modified');

    // Wait for debounce
    await Bun.sleep(200);

    // The path should be relative: subdir/nested.txt
    expect(onChangeMock).toHaveBeenCalled();
    const calls = onChangeMock.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall?.[0]).toContain('nested.txt');
  });

  test('unwatchDir - should stop watching a directory', () => {
    const subDir = join(testDir, 'subdir');
    mkdirSync(subDir, { recursive: true });

    watcher.watchDir('subdir');
    expect(watcher.isWatchingDir('subdir')).toBe(true);

    watcher.unwatchDir('subdir');
    expect(watcher.isWatchingDir('subdir')).toBe(false);
    expect(watcher.watcherCount).toBe(0);
  });

  test('close - should close all watchers', () => {
    const file1 = join(testDir, 'file1.txt');
    const file2 = join(testDir, 'file2.txt');
    const subDir = join(testDir, 'subdir');
    mkdirSync(subDir, { recursive: true });

    writeFileSync(file1, 'content');
    writeFileSync(file2, 'content');

    watcher.watchFile('file1.txt');
    watcher.watchFile('file2.txt');
    watcher.watchDir('subdir');

    expect(watcher.watcherCount).toBe(3);

    watcher.close();

    expect(watcher.watcherCount).toBe(0);
  });

  test('debounce - should debounce rapid changes', async () => {
    const filePath = join(testDir, 'rapid.txt');
    writeFileSync(filePath, 'initial');

    watcher.watchFile('rapid.txt');

    // Rapid modifications
    await Bun.sleep(10);
    writeFileSync(filePath, 'change1');
    await Bun.sleep(10);
    writeFileSync(filePath, 'change2');
    await Bun.sleep(10);
    writeFileSync(filePath, 'change3');

    // Wait for debounce
    await Bun.sleep(200);

    // Should be called only once (debounced)
    const callCount = onChangeMock.mock.calls.length;
    expect(callCount).toBeGreaterThanOrEqual(1);
    // Due to debouncing, we should have fewer calls than changes
    expect(callCount).toBeLessThanOrEqual(2);
  });

  test('watchFile - should handle non-existent file gracefully', () => {
    // This should not throw
    watcher.watchFile('nonexistent.txt');
    // Watcher should not be created for non-existent file
    expect(watcher.isWatchingFile('nonexistent.txt')).toBe(false);
  });

  test('unwatchFile - should handle unwatching non-watched file gracefully', () => {
    // This should not throw
    watcher.unwatchFile('never-watched.txt');
  });
});
