import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  type NotificationMatcher,
  type PatternConfig,
  createNotificationMatcher
} from './matcher.js';

describe('NotificationMatcher', () => {
  let matcher: NotificationMatcher;
  const patterns: PatternConfig[] = [
    { regex: '\\?\\s*$', message: 'Question detected', cooldown: 60 },
    { regex: '\\[Y/n\\]', message: 'Confirmation required', cooldown: 30 },
    { regex: 'ERROR', message: 'Error detected' }
  ];

  beforeEach(() => {
    matcher = createNotificationMatcher({ patterns, defaultCooldown: 300 });
  });

  afterEach(() => {
    matcher.reset();
  });

  describe('match', () => {
    test('matches question pattern', () => {
      const result = matcher.match('session1', 'What is your name?');
      expect(result).not.toBeNull();
      expect(result?.pattern.message).toBe('Question detected');
      expect(result?.matchedText).toBe('What is your name?');
    });

    test('matches confirmation pattern', () => {
      const result = matcher.match('session1', 'Continue? [Y/n]');
      expect(result).not.toBeNull();
      expect(result?.pattern.message).toBe('Confirmation required');
    });

    test('matches error pattern', () => {
      const result = matcher.match('session1', 'ERROR: Something went wrong');
      expect(result).not.toBeNull();
      expect(result?.pattern.message).toBe('Error detected');
    });

    test('returns null for no match', () => {
      const result = matcher.match('session1', 'Hello world');
      expect(result).toBeNull();
    });

    test('respects cooldown period', () => {
      // First match should succeed
      const result1 = matcher.match('session1', 'What?');
      expect(result1).not.toBeNull();

      // Second match should fail (cooldown)
      const result2 = matcher.match('session1', 'Why?');
      expect(result2).toBeNull();
    });

    test('different sessions have separate cooldowns', () => {
      const result1 = matcher.match('session1', 'What?');
      expect(result1).not.toBeNull();

      // Different session should still match
      const result2 = matcher.match('session2', 'Why?');
      expect(result2).not.toBeNull();
    });

    test('different patterns have separate cooldowns', () => {
      const result1 = matcher.match('session1', 'What?');
      expect(result1).not.toBeNull();

      // Different pattern should still match
      const result2 = matcher.match('session1', 'ERROR');
      expect(result2).not.toBeNull();
    });

    test('uses default cooldown when pattern has no cooldown', () => {
      // ERROR pattern has no cooldown, should use default (300s)
      const result1 = matcher.match('session1', 'ERROR');
      expect(result1).not.toBeNull();

      // Should be in cooldown
      const result2 = matcher.match('session1', 'ERROR');
      expect(result2).toBeNull();
    });
  });

  describe('matchesPattern', () => {
    test('returns true for matching text', () => {
      expect(matcher.matchesPattern('\\?\\s*$', 'What?')).toBe(true);
    });

    test('returns false for non-matching text', () => {
      expect(matcher.matchesPattern('\\?\\s*$', 'Hello')).toBe(false);
    });

    test('handles invalid regex gracefully', () => {
      expect(matcher.matchesPattern('[invalid', 'test')).toBe(false);
    });
  });

  describe('clearCooldown', () => {
    test('clears cooldown for specific session and pattern', () => {
      // Trigger cooldown
      matcher.match('session1', 'What?');
      expect(matcher.match('session1', 'Why?')).toBeNull();

      // Clear cooldown
      matcher.clearCooldown('session1', '\\?\\s*$');

      // Should match again
      expect(matcher.match('session1', 'How?')).not.toBeNull();
    });
  });

  describe('reset', () => {
    test('clears all cooldowns', () => {
      matcher.match('session1', 'What?');
      matcher.match('session2', 'ERROR');

      matcher.reset();

      // Both should match again
      expect(matcher.match('session1', 'Why?')).not.toBeNull();
      expect(matcher.match('session2', 'ERROR')).not.toBeNull();
    });
  });

  describe('empty patterns', () => {
    test('returns null when no patterns configured', () => {
      const emptyMatcher = createNotificationMatcher({ patterns: [], defaultCooldown: 60 });
      const result = emptyMatcher.match('session1', 'What?');
      expect(result).toBeNull();
    });
  });

  describe('invalid patterns', () => {
    test('skips invalid regex patterns during creation', () => {
      // Creating matcher with invalid regex should not throw
      const invalidMatcher = createNotificationMatcher({
        patterns: [
          { regex: '[invalid', message: 'Invalid regex' },
          { regex: '\\?$', message: 'Valid question pattern' }
        ],
        defaultCooldown: 60
      });

      // Invalid pattern should be skipped, but valid one should work
      const result = invalidMatcher.match('session1', 'What?');
      expect(result).not.toBeNull();
      expect(result?.pattern.message).toBe('Valid question pattern');

      // No match for the invalid pattern
      const noMatch = invalidMatcher.match('session2', '[invalid');
      expect(noMatch).toBeNull();
    });
  });

  describe('bell notification', () => {
    test('matches bell character (\\x07)', () => {
      const bellMatcher = createNotificationMatcher({
        patterns: [{ regex: '\x07', message: 'Terminal bell', cooldown: 10 }],
        defaultCooldown: 60
      });

      const result = bellMatcher.match('session1', 'Output with bell\x07');
      expect(result).not.toBeNull();
      expect(result?.pattern.message).toBe('Terminal bell');
    });

    test('matches standalone bell character', () => {
      const bellMatcher = createNotificationMatcher({
        patterns: [{ regex: '\x07', message: 'Terminal bell', cooldown: 10 }],
        defaultCooldown: 60
      });

      const result = bellMatcher.match('session1', '\x07');
      expect(result).not.toBeNull();
    });

    test('bell has separate cooldown from other patterns', () => {
      const bellMatcher = createNotificationMatcher({
        patterns: [
          { regex: '\x07', message: 'Terminal bell', cooldown: 10 },
          { regex: '\\?$', message: 'Question', cooldown: 60 }
        ],
        defaultCooldown: 300
      });

      // Bell should match
      const bellResult = bellMatcher.match('session1', '\x07');
      expect(bellResult).not.toBeNull();

      // Question should still match (different pattern)
      const questionResult = bellMatcher.match('session1', 'What?');
      expect(questionResult).not.toBeNull();

      // Bell should be in cooldown
      const bellResult2 = bellMatcher.match('session1', '\x07');
      expect(bellResult2).toBeNull();
    });
  });
});
