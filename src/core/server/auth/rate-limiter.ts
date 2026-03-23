/**
 * Sliding Window Rate Limiter for authentication endpoints.
 *
 * IP-based rate limiting to prevent brute-force attacks on
 * OTP verify, token exchange, and WebSocket upgrade endpoints.
 */

export interface RateLimiterOptions {
  /** Window size in milliseconds */
  readonly windowMs: number;
  /** Maximum requests allowed within the window */
  readonly maxRequests: number;
  /** Clock function for testing (defaults to Date.now) */
  readonly nowFn?: () => number;
}

interface TimestampEntry {
  readonly timestamps: number[];
}

export class SlidingWindowRateLimiter implements Disposable {
  private readonly entries = new Map<string, TimestampEntry>();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly now: () => number;

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
    this.now = options.nowFn ?? Date.now;
  }

  /**
   * Check if a request from the given key (IP) is allowed.
   * Records the request if allowed.
   */
  isAllowed(key: string): boolean {
    const now = this.now();
    const windowStart = now - this.windowMs;

    const entry = this.entries.get(key);
    const recent = entry ? entry.timestamps.filter((t) => t > windowStart) : [];

    if (recent.length >= this.maxRequests) {
      // Update with pruned timestamps but don't add new one
      this.entries.set(key, { timestamps: recent });
      return false;
    }

    // Record this request
    this.entries.set(key, { timestamps: [...recent, now] });
    return true;
  }

  /**
   * Reset rate limit state for a specific key.
   */
  reset(key: string): void {
    this.entries.delete(key);
  }

  /**
   * Remove expired entries. Returns count of removed entries.
   */
  cleanup(): number {
    const now = this.now();
    const windowStart = now - this.windowMs;
    let removed = 0;

    for (const [key, entry] of this.entries) {
      const recent = entry.timestamps.filter((t) => t > windowStart);
      if (recent.length === 0) {
        this.entries.delete(key);
        removed++;
      } else {
        this.entries.set(key, { timestamps: recent });
      }
    }

    return removed;
  }

  /**
   * Dispose and clear all state.
   */
  dispose(): void {
    this.entries.clear();
  }

  [Symbol.dispose](): void {
    this.dispose();
  }
}
