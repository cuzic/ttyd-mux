/**
 * Share Feature Module
 *
 * Read-only terminal sharing with time-limited links.
 */

export {
  createShareManager,
  type ShareManager,
  type ShareState,
  type ShareStore,
  type CreateShareOptions,
  generateSecureToken,
  hashPassword,
  verifyPassword,
  parseExpiresIn
} from './server/share-manager.js';
