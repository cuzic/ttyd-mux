import { describe, expect, test } from 'bun:test';
import type { TmuxSession } from './types.js';
import { calculateNewIndex, findInitialIndex, formatDate, handleKeypress } from './ui.js';

describe('ui', () => {
  describe('formatDate', () => {
    test('formats date with zero-padded month and day', () => {
      const date = new Date(2024, 0, 5, 9, 30); // Jan 5, 2024 09:30
      expect(formatDate(date)).toBe('01/05 09:30');
    });

    test('formats date with double-digit values', () => {
      const date = new Date(2024, 11, 25, 14, 45); // Dec 25, 2024 14:45
      expect(formatDate(date)).toBe('12/25 14:45');
    });

    test('formats midnight correctly', () => {
      const date = new Date(2024, 5, 15, 0, 0); // Jun 15, 2024 00:00
      expect(formatDate(date)).toBe('06/15 00:00');
    });

    test('formats end of day correctly', () => {
      const date = new Date(2024, 2, 1, 23, 59); // Mar 1, 2024 23:59
      expect(formatDate(date)).toBe('03/01 23:59');
    });
  });

  describe('handleKeypress', () => {
    test('returns none for undefined key', () => {
      expect(handleKeypress(undefined, 3)).toEqual({ type: 'none' });
    });

    test('returns quit for q key', () => {
      expect(handleKeypress({ name: 'q' }, 3)).toEqual({ type: 'quit' });
    });

    test('returns quit for Ctrl+C', () => {
      expect(handleKeypress({ name: 'c', ctrl: true }, 3)).toEqual({
        type: 'quit'
      });
    });

    test('returns move up for up arrow', () => {
      expect(handleKeypress({ name: 'up' }, 3)).toEqual({
        type: 'move',
        direction: 'up'
      });
    });

    test('returns move up for k key (vim)', () => {
      expect(handleKeypress({ name: 'k' }, 3)).toEqual({
        type: 'move',
        direction: 'up'
      });
    });

    test('returns move down for down arrow', () => {
      expect(handleKeypress({ name: 'down' }, 3)).toEqual({
        type: 'move',
        direction: 'down'
      });
    });

    test('returns move down for j key (vim)', () => {
      expect(handleKeypress({ name: 'j' }, 3)).toEqual({
        type: 'move',
        direction: 'down'
      });
    });

    test('returns select with -1 for enter key', () => {
      expect(handleKeypress({ name: 'return' }, 3)).toEqual({
        type: 'select',
        index: -1
      });
    });

    test('returns select with index for number keys 1-9', () => {
      expect(handleKeypress({ name: '1' }, 5)).toEqual({
        type: 'select',
        index: 0
      });
      expect(handleKeypress({ name: '3' }, 5)).toEqual({
        type: 'select',
        index: 2
      });
      expect(handleKeypress({ name: '5' }, 5)).toEqual({
        type: 'select',
        index: 4
      });
    });

    test('returns none for number key exceeding session count', () => {
      expect(handleKeypress({ name: '5' }, 3)).toEqual({ type: 'none' });
      expect(handleKeypress({ name: '9' }, 2)).toEqual({ type: 'none' });
    });

    test('returns none for zero key', () => {
      expect(handleKeypress({ name: '0' }, 5)).toEqual({ type: 'none' });
    });

    test('returns none for unrecognized keys', () => {
      expect(handleKeypress({ name: 'x' }, 3)).toEqual({ type: 'none' });
      expect(handleKeypress({ name: 'space' }, 3)).toEqual({ type: 'none' });
    });

    test('does not quit with Ctrl+other key', () => {
      expect(handleKeypress({ name: 'a', ctrl: true }, 3)).toEqual({
        type: 'none'
      });
    });
  });

  describe('findInitialIndex', () => {
    test('returns 0 for empty sessions', () => {
      expect(findInitialIndex([])).toBe(0);
    });

    test('returns 0 when no session is attached', () => {
      const sessions: TmuxSession[] = [
        { name: 'first', windows: 1, created: new Date(), attached: false },
        { name: 'second', windows: 1, created: new Date(), attached: false }
      ];
      expect(findInitialIndex(sessions)).toBe(0);
    });

    test('returns index of attached session', () => {
      const sessions: TmuxSession[] = [
        { name: 'first', windows: 1, created: new Date(), attached: false },
        { name: 'second', windows: 1, created: new Date(), attached: true },
        { name: 'third', windows: 1, created: new Date(), attached: false }
      ];
      expect(findInitialIndex(sessions)).toBe(1);
    });

    test('returns first attached session when multiple are attached', () => {
      const sessions: TmuxSession[] = [
        { name: 'first', windows: 1, created: new Date(), attached: false },
        { name: 'second', windows: 1, created: new Date(), attached: true },
        { name: 'third', windows: 1, created: new Date(), attached: true }
      ];
      expect(findInitialIndex(sessions)).toBe(1);
    });

    test('returns 0 when first session is attached', () => {
      const sessions: TmuxSession[] = [
        { name: 'first', windows: 1, created: new Date(), attached: true },
        { name: 'second', windows: 1, created: new Date(), attached: false }
      ];
      expect(findInitialIndex(sessions)).toBe(0);
    });
  });

  describe('calculateNewIndex', () => {
    test('moves up from middle', () => {
      expect(calculateNewIndex(2, 'up', 4)).toBe(1);
    });

    test('moves down from middle', () => {
      expect(calculateNewIndex(2, 'down', 4)).toBe(3);
    });

    test('does not move up from 0', () => {
      expect(calculateNewIndex(0, 'up', 4)).toBe(0);
    });

    test('does not move down from max', () => {
      expect(calculateNewIndex(4, 'down', 4)).toBe(4);
    });

    test('moves up from 1 to 0', () => {
      expect(calculateNewIndex(1, 'up', 4)).toBe(0);
    });

    test('moves down from max-1 to max', () => {
      expect(calculateNewIndex(3, 'down', 4)).toBe(4);
    });

    test('handles single item list', () => {
      expect(calculateNewIndex(0, 'up', 0)).toBe(0);
      expect(calculateNewIndex(0, 'down', 0)).toBe(0);
    });
  });
});
