/**
 * Share Manager - Manages read-only share links for terminal sessions
 */

import { randomBytes } from 'node:crypto';

/**
 * Share state stored in state.json
 */
export interface ShareState {
  token: string;
  sessionName: string;
  createdAt: string;
  expiresAt: string;
  password?: string; // For future: hashed password if set
}

/**
 * Options for creating a share
 */
export interface CreateShareOptions {
  expiresIn?: string; // e.g., '1h', '30m', '7d'
  password?: string;
}

/**
 * Store interface for share persistence (allows DI for testing)
 */
export interface ShareStore {
  getShares(): ShareState[];
  addShare(share: ShareState): void;
  removeShare(token: string): void;
  getShare(token: string): ShareState | undefined;
}

/**
 * ShareManager interface
 */
export interface ShareManager {
  createShare(sessionName: string, options?: CreateShareOptions): ShareState;
  validateShare(token: string): ShareState | null;
  revokeShare(token: string): boolean;
  listShares(): ShareState[];
  cleanupExpiredShares(): number;
  getShare(token: string): ShareState | undefined;
}

/**
 * Generate a cryptographically secure token
 */
export function generateSecureToken(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Parse expiration time string to milliseconds
 * Supports: '1h', '30m', '7d'
 * Default: 1 hour
 */
export function parseExpiresIn(expiresIn: string): number {
  const DEFAULT_EXPIRY_MS = 3600000; // 1 hour

  if (!expiresIn || expiresIn.length < 2) {
    return DEFAULT_EXPIRY_MS;
  }

  const unit = expiresIn.slice(-1);
  const value = Number.parseInt(expiresIn.slice(0, -1), 10);

  if (Number.isNaN(value)) {
    return DEFAULT_EXPIRY_MS;
  }

  switch (unit) {
    case 'h':
      return value * 60 * 60 * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return DEFAULT_EXPIRY_MS;
  }
}

/**
 * Check if a share is expired
 */
function isExpired(share: ShareState): boolean {
  return new Date(share.expiresAt).getTime() <= Date.now();
}

/**
 * Create a ShareManager with the given store
 */
export function createShareManager(store: ShareStore): ShareManager {
  return {
    createShare(sessionName: string, options: CreateShareOptions = {}): ShareState {
      const token = generateSecureToken();
      const now = new Date();
      const expiresInMs = parseExpiresIn(options.expiresIn ?? '1h');
      const expiresAt = new Date(now.getTime() + expiresInMs);

      const share: ShareState = {
        token,
        sessionName,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString()
      };

      if (options.password) {
        // For now, store password as-is (TODO: hash in future)
        share.password = options.password;
      }

      store.addShare(share);
      return share;
    },

    validateShare(token: string): ShareState | null {
      const share = store.getShare(token);
      if (!share) {
        return null;
      }

      if (isExpired(share)) {
        // Remove expired share
        store.removeShare(token);
        return null;
      }

      return share;
    },

    revokeShare(token: string): boolean {
      const share = store.getShare(token);
      if (!share) {
        return false;
      }
      store.removeShare(token);
      return true;
    },

    listShares(): ShareState[] {
      const shares = store.getShares();
      const validShares: ShareState[] = [];

      for (const share of shares) {
        if (isExpired(share)) {
          store.removeShare(share.token);
        } else {
          validShares.push(share);
        }
      }

      return validShares;
    },

    cleanupExpiredShares(): number {
      const shares = store.getShares();
      let removed = 0;

      for (const share of shares) {
        if (isExpired(share)) {
          store.removeShare(share.token);
          removed++;
        }
      }

      return removed;
    },

    getShare(token: string): ShareState | undefined {
      return store.getShare(token);
    }
  };
}
