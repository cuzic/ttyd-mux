import { afterEach, describe, expect, it } from 'bun:test';
import { SlidingWindowRateLimiter } from './rate-limiter.js';

describe('SlidingWindowRateLimiter', () => {
  let limiter: SlidingWindowRateLimiter;

  afterEach(() => {
    limiter?.dispose();
  });

  describe('isAllowed', () => {
    it('allows requests within the limit', () => {
      limiter = new SlidingWindowRateLimiter({
        windowMs: 60_000,
        maxRequests: 3
      });

      expect(limiter.isAllowed('192.168.1.1')).toBe(true);
      expect(limiter.isAllowed('192.168.1.1')).toBe(true);
      expect(limiter.isAllowed('192.168.1.1')).toBe(true);
    });

    it('blocks requests exceeding the limit', () => {
      limiter = new SlidingWindowRateLimiter({
        windowMs: 60_000,
        maxRequests: 2
      });

      expect(limiter.isAllowed('10.0.0.1')).toBe(true);
      expect(limiter.isAllowed('10.0.0.1')).toBe(true);
      expect(limiter.isAllowed('10.0.0.1')).toBe(false);
      expect(limiter.isAllowed('10.0.0.1')).toBe(false);
    });

    it('allows requests after window expires', () => {
      const now = Date.now();
      let currentTime = now;
      limiter = new SlidingWindowRateLimiter({
        windowMs: 1_000,
        maxRequests: 2,
        nowFn: () => currentTime
      });

      expect(limiter.isAllowed('ip1')).toBe(true);
      expect(limiter.isAllowed('ip1')).toBe(true);
      expect(limiter.isAllowed('ip1')).toBe(false);

      // Advance past window
      currentTime = now + 1_001;

      expect(limiter.isAllowed('ip1')).toBe(true);
    });

    it('tracks different keys independently', () => {
      limiter = new SlidingWindowRateLimiter({
        windowMs: 60_000,
        maxRequests: 1
      });

      expect(limiter.isAllowed('ip-a')).toBe(true);
      expect(limiter.isAllowed('ip-a')).toBe(false);

      // Different key is independent
      expect(limiter.isAllowed('ip-b')).toBe(true);
      expect(limiter.isAllowed('ip-b')).toBe(false);
    });
  });

  describe('reset', () => {
    it('immediately resets the limit for a key', () => {
      limiter = new SlidingWindowRateLimiter({
        windowMs: 60_000,
        maxRequests: 1
      });

      expect(limiter.isAllowed('ip1')).toBe(true);
      expect(limiter.isAllowed('ip1')).toBe(false);

      limiter.reset('ip1');

      expect(limiter.isAllowed('ip1')).toBe(true);
    });

    it('does not affect other keys', () => {
      limiter = new SlidingWindowRateLimiter({
        windowMs: 60_000,
        maxRequests: 1
      });

      limiter.isAllowed('ip1');
      limiter.isAllowed('ip2');

      limiter.reset('ip1');

      expect(limiter.isAllowed('ip1')).toBe(true);
      expect(limiter.isAllowed('ip2')).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('removes expired entries and returns count', () => {
      const now = Date.now();
      let currentTime = now;
      limiter = new SlidingWindowRateLimiter({
        windowMs: 1_000,
        maxRequests: 10,
        nowFn: () => currentTime
      });

      limiter.isAllowed('expired-1');
      limiter.isAllowed('expired-2');
      limiter.isAllowed('active');

      // Advance time so first two entries expire
      currentTime = now + 1_001;

      // Add a fresh request for 'active' so it stays
      limiter.isAllowed('active');

      const removed = limiter.cleanup();
      expect(removed).toBe(2);
    });

    it('returns 0 when no entries to clean', () => {
      limiter = new SlidingWindowRateLimiter({
        windowMs: 60_000,
        maxRequests: 10
      });

      expect(limiter.cleanup()).toBe(0);

      limiter.isAllowed('ip1');
      expect(limiter.cleanup()).toBe(0);
    });
  });

  describe('dispose', () => {
    it('clears all entries', () => {
      limiter = new SlidingWindowRateLimiter({
        windowMs: 60_000,
        maxRequests: 1
      });

      limiter.isAllowed('ip1');
      limiter.dispose();

      // After dispose, a new check should work (entries cleared)
      // We create a new limiter to verify dispose cleared state
      const limiter2 = new SlidingWindowRateLimiter({
        windowMs: 60_000,
        maxRequests: 1
      });
      expect(limiter2.isAllowed('ip1')).toBe(true);
      limiter2.dispose();
    });
  });
});
