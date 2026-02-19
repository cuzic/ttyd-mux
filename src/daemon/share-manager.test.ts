import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  type ShareManager,
  createShareManager,
  generateSecureToken,
  parseExpiresIn
} from './share-manager.js';

describe('generateSecureToken', () => {
  test('generates a 32-character hex string', () => {
    const token = generateSecureToken();
    expect(token).toHaveLength(32);
    expect(token).toMatch(/^[a-f0-9]+$/);
  });

  test('generates unique tokens', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateSecureToken());
    }
    expect(tokens.size).toBe(100);
  });
});

describe('parseExpiresIn', () => {
  test('parses hours', () => {
    expect(parseExpiresIn('1h')).toBe(3600000);
    expect(parseExpiresIn('2h')).toBe(7200000);
    expect(parseExpiresIn('24h')).toBe(86400000);
  });

  test('parses minutes', () => {
    expect(parseExpiresIn('30m')).toBe(1800000);
    expect(parseExpiresIn('60m')).toBe(3600000);
  });

  test('parses days', () => {
    expect(parseExpiresIn('1d')).toBe(86400000);
    expect(parseExpiresIn('7d')).toBe(604800000);
  });

  test('defaults to 1 hour for invalid input', () => {
    expect(parseExpiresIn('')).toBe(3600000);
    expect(parseExpiresIn('invalid')).toBe(3600000);
    expect(parseExpiresIn('abc')).toBe(3600000);
  });
});

describe('ShareManager', () => {
  let manager: ShareManager;
  let shares: Map<string, unknown>;

  beforeEach(() => {
    shares = new Map();
    manager = createShareManager({
      getShares: () => Array.from(shares.values()) as ReturnType<ShareManager['listShares']>,
      addShare: (share) => { shares.set(share.token, share); },
      removeShare: (token) => { shares.delete(token); },
      getShare: (token) => shares.get(token) as ReturnType<ShareManager['getShare']>
    });
  });

  afterEach(() => {
    shares.clear();
  });

  describe('createShare', () => {
    test('creates a share with default expiration', () => {
      const share = manager.createShare('test-session');
      expect(share.token).toHaveLength(32);
      expect(share.sessionName).toBe('test-session');
      expect(share.createdAt).toBeDefined();
      expect(share.expiresAt).toBeDefined();
      // Default 1 hour expiration
      const createdAt = new Date(share.createdAt).getTime();
      const expiresAt = new Date(share.expiresAt).getTime();
      expect(expiresAt - createdAt).toBe(3600000);
    });

    test('creates a share with custom expiration', () => {
      const share = manager.createShare('test-session', { expiresIn: '30m' });
      const createdAt = new Date(share.createdAt).getTime();
      const expiresAt = new Date(share.expiresAt).getTime();
      expect(expiresAt - createdAt).toBe(1800000);
    });

    test('stores the share', () => {
      const share = manager.createShare('test-session');
      expect(shares.has(share.token)).toBe(true);
    });
  });

  describe('validateShare', () => {
    test('returns share if valid', () => {
      const share = manager.createShare('test-session');
      const result = manager.validateShare(share.token);
      expect(result).not.toBeNull();
      expect(result?.sessionName).toBe('test-session');
    });

    test('returns null for non-existent token', () => {
      const result = manager.validateShare('nonexistent');
      expect(result).toBeNull();
    });

    test('returns null for expired share', () => {
      // Create share with immediate expiration
      const share = manager.createShare('test-session', { expiresIn: '0m' });
      const result = manager.validateShare(share.token);
      expect(result).toBeNull();
    });

    test('removes expired share from storage', () => {
      const share = manager.createShare('test-session', { expiresIn: '0m' });
      manager.validateShare(share.token);
      expect(shares.has(share.token)).toBe(false);
    });
  });

  describe('revokeShare', () => {
    test('removes the share', () => {
      const share = manager.createShare('test-session');
      expect(shares.has(share.token)).toBe(true);
      manager.revokeShare(share.token);
      expect(shares.has(share.token)).toBe(false);
    });

    test('returns true if share was removed', () => {
      const share = manager.createShare('test-session');
      const result = manager.revokeShare(share.token);
      expect(result).toBe(true);
    });

    test('returns false if share did not exist', () => {
      const result = manager.revokeShare('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('listShares', () => {
    test('returns empty array when no shares', () => {
      const result = manager.listShares();
      expect(result).toEqual([]);
    });

    test('returns all shares', () => {
      manager.createShare('session1');
      manager.createShare('session2');
      const result = manager.listShares();
      expect(result).toHaveLength(2);
    });

    test('filters out expired shares', () => {
      manager.createShare('valid-session', { expiresIn: '1h' });
      manager.createShare('expired-session', { expiresIn: '0m' });
      const result = manager.listShares();
      expect(result).toHaveLength(1);
      expect(result[0].sessionName).toBe('valid-session');
    });
  });

  describe('cleanupExpiredShares', () => {
    test('removes expired shares', () => {
      manager.createShare('valid-session', { expiresIn: '1h' });
      manager.createShare('expired-session', { expiresIn: '0m' });
      expect(shares.size).toBe(2);
      manager.cleanupExpiredShares();
      expect(shares.size).toBe(1);
    });

    test('returns number of removed shares', () => {
      manager.createShare('expired1', { expiresIn: '0m' });
      manager.createShare('expired2', { expiresIn: '0m' });
      manager.createShare('valid', { expiresIn: '1h' });
      const count = manager.cleanupExpiredShares();
      expect(count).toBe(2);
    });
  });
});
