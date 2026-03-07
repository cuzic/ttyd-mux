/**
 * Run Cache
 *
 * Caches AI run results to avoid duplicate queries.
 * Uses hash of (question + context) as cache key.
 */

import { createHash } from 'node:crypto';
import type { AIChatResponse } from './types.js';

export interface CacheEntry {
  response: AIChatResponse;
  createdAt: number;
  accessCount: number;
  lastAccessedAt: number;
}

export interface RunCacheOptions {
  /** Maximum number of entries in cache */
  maxEntries?: number;
  /** TTL in milliseconds (default: 1 hour) */
  ttlMs?: number;
  /** Enable cache (default: true) */
  enabled?: boolean;
}

const DEFAULT_OPTIONS: Required<RunCacheOptions> = {
  maxEntries: 100,
  ttlMs: 60 * 60 * 1000, // 1 hour
  enabled: true
};

/**
 * Cache for AI run results
 */
export class RunCache {
  private cache: Map<string, CacheEntry> = new Map();
  private options: Required<RunCacheOptions>;

  constructor(options: RunCacheOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Generate cache key from question and context
   */
  generateKey(question: string, context: string, runner: string): string {
    const input = `${runner}:${question}:${context}`;
    return createHash('sha256').update(input).digest('hex').slice(0, 16);
  }

  /**
   * Get cached response if available and not expired
   */
  get(key: string): AIChatResponse | null {
    if (!this.options.enabled) {
      return null;
    }

    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now - entry.createdAt > this.options.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // Update access stats
    entry.accessCount++;
    entry.lastAccessedAt = now;

    // Mark response as cached
    return {
      ...entry.response,
      cached: true
    };
  }

  /**
   * Store response in cache
   */
  set(key: string, response: AIChatResponse): void {
    if (!this.options.enabled) {
      return;
    }

    // Evict if at capacity
    if (this.cache.size >= this.options.maxEntries) {
      this.evictLRU();
    }

    const now = Date.now();
    this.cache.set(key, {
      response: { ...response, cached: false },
      createdAt: now,
      accessCount: 1,
      lastAccessedAt: now
    });
  }

  /**
   * Invalidate a specific cache entry
   */
  invalidate(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Invalidate all entries for a session
   */
  invalidateSession(sessionId: string): number {
    let count = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.response.runId.includes(sessionId)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxEntries: number;
    ttlMs: number;
    enabled: boolean;
  } {
    return {
      size: this.cache.size,
      maxEntries: this.options.maxEntries,
      ttlMs: this.options.ttlMs,
      enabled: this.options.enabled
    };
  }

  /**
   * Evict expired entries
   */
  evictExpired(): number {
    const now = Date.now();
    let count = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.createdAt > this.options.ttlMs) {
        this.cache.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Number.POSITIVE_INFINITY;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessedAt < oldestTime) {
        oldestTime = entry.lastAccessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Enable or disable cache
   */
  setEnabled(enabled: boolean): void {
    this.options.enabled = enabled;
    if (!enabled) {
      this.clear();
    }
  }
}
