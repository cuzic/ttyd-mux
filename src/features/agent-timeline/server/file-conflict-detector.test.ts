/**
 * FileConflictDetector Tests
 *
 * TDD: RED → GREEN → REFACTOR
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import { FileConflictDetector } from './file-conflict-detector.js';

describe('FileConflictDetector', () => {
  let detector: FileConflictDetector;

  beforeEach(() => {
    detector = new FileConflictDetector();
  });

  it('returns no conflicts when a single agent edits a file', () => {
    detector.trackFileEdit('agent-1', 'Edit', '/src/index.ts');
    const conflicts = detector.getConflicts();
    expect(conflicts).toEqual([]);
  });

  it('detects conflict when 2 agents edit the same file', () => {
    detector.trackFileEdit('agent-1', 'Edit', '/src/index.ts');
    detector.trackFileEdit('agent-2', 'Write', '/src/index.ts');

    const conflicts = detector.getConflicts();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].filePath).toBe('/src/index.ts');
    expect(conflicts[0].agents).toContain('agent-1');
    expect(conflicts[0].agents).toContain('agent-2');
    expect(conflicts[0].detectedAt).toBeTruthy();
  });

  it('returns no conflicts when 2 agents edit different files', () => {
    detector.trackFileEdit('agent-1', 'Edit', '/src/foo.ts');
    detector.trackFileEdit('agent-2', 'Write', '/src/bar.ts');

    const conflicts = detector.getConflicts();
    expect(conflicts).toEqual([]);
  });

  it('detects 3 agents editing the same file', () => {
    detector.trackFileEdit('agent-1', 'Edit', '/src/index.ts');
    detector.trackFileEdit('agent-2', 'Edit', '/src/index.ts');
    detector.trackFileEdit('agent-3', 'Write', '/src/index.ts');

    const conflicts = detector.getConflicts();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].agents).toHaveLength(3);
    expect(conflicts[0].agents).toContain('agent-1');
    expect(conflicts[0].agents).toContain('agent-2');
    expect(conflicts[0].agents).toContain('agent-3');
  });

  it('removes stale entries on cleanup (older than window)', () => {
    // Track an edit, then simulate time passing by using a short window
    const shortWindowDetector = new FileConflictDetector(100); // 100ms window
    shortWindowDetector.trackFileEdit('agent-1', 'Edit', '/src/index.ts');

    // Wait for the window to expire
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        shortWindowDetector.trackFileEdit('agent-2', 'Edit', '/src/index.ts');
        shortWindowDetector.cleanup();
        // agent-1's entry should be cleaned up, so no conflict
        const conflicts = shortWindowDetector.getConflicts();
        expect(conflicts).toEqual([]);
        resolve();
      }, 150);
    });
  });

  it('does not duplicate agent in same file tracking', () => {
    detector.trackFileEdit('agent-1', 'Edit', '/src/index.ts');
    detector.trackFileEdit('agent-1', 'Write', '/src/index.ts');
    detector.trackFileEdit('agent-2', 'Edit', '/src/index.ts');

    const conflicts = detector.getConflicts();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].agents).toHaveLength(2);
  });

  it('tracks multiple files with mixed conflicts', () => {
    detector.trackFileEdit('agent-1', 'Edit', '/src/a.ts');
    detector.trackFileEdit('agent-2', 'Edit', '/src/a.ts');
    detector.trackFileEdit('agent-1', 'Edit', '/src/b.ts');
    detector.trackFileEdit('agent-3', 'Write', '/src/c.ts');

    const conflicts = detector.getConflicts();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].filePath).toBe('/src/a.ts');
  });

  it('only tracks Edit and Write tools via isFileEditTool', () => {
    // Read, Grep, Glob should not be tracked
    detector.trackFileEdit('agent-1', 'Read', '/src/index.ts');
    detector.trackFileEdit('agent-2', 'Grep', '/src/index.ts');
    const conflicts = detector.getConflicts();
    expect(conflicts).toEqual([]);
  });
});
