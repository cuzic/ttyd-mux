/**
 * Pattern matcher for notification triggers
 */

import type { MatchResult, PatternConfig } from './types.js';

/**
 * Matcher configuration
 */
export interface MatcherConfig {
  patterns: PatternConfig[];
  defaultCooldown: number; // seconds
}

/**
 * NotificationMatcher interface
 */
export interface NotificationMatcher {
  /** Match text against patterns, respecting cooldowns */
  match(sessionName: string, text: string): MatchResult | null;
  /** Check if text matches a specific pattern (ignores cooldown) */
  matchesPattern(regex: string, text: string): boolean;
  /** Clear cooldown for a specific session and pattern */
  clearCooldown(sessionName: string, regex: string): void;
  /** Reset all cooldowns */
  reset(): void;
}

// Re-export for convenience
export type { PatternConfig, MatchResult };

/**
 * Create a cooldown key for tracking
 */
function getCooldownKey(sessionName: string, regex: string): string {
  return `${sessionName}:${regex}`;
}

/**
 * Create a notification matcher
 */
export function createNotificationMatcher(config: MatcherConfig): NotificationMatcher {
  const { patterns, defaultCooldown } = config;

  // Map of cooldown key -> timestamp when cooldown expires
  const cooldowns = new Map<string, number>();

  // Pre-compile regexes
  const compiledPatterns: Array<{ config: PatternConfig; regex: RegExp }> = [];
  for (const pattern of patterns) {
    try {
      compiledPatterns.push({
        config: pattern,
        regex: new RegExp(pattern.regex)
      });
    } catch {
      // Invalid regex pattern - skip silently
    }
  }

  return {
    match(sessionName: string, text: string): MatchResult | null {
      const now = Date.now();

      for (const { config: pattern, regex } of compiledPatterns) {
        if (regex.test(text)) {
          const key = getCooldownKey(sessionName, pattern.regex);
          const cooldownExpires = cooldowns.get(key);

          // Check if in cooldown period
          if (cooldownExpires && now < cooldownExpires) {
            continue; // Still in cooldown, try next pattern
          }

          // Set cooldown
          const cooldownSeconds = pattern.cooldown ?? defaultCooldown;
          cooldowns.set(key, now + cooldownSeconds * 1000);

          return {
            pattern,
            matchedText: text,
            sessionName,
            timestamp: new Date().toISOString()
          };
        }
      }

      return null;
    },

    matchesPattern(regex: string, text: string): boolean {
      try {
        return new RegExp(regex).test(text);
      } catch {
        return false;
      }
    },

    clearCooldown(sessionName: string, regex: string): void {
      const key = getCooldownKey(sessionName, regex);
      cooldowns.delete(key);
    },

    reset(): void {
      cooldowns.clear();
    }
  };
}
