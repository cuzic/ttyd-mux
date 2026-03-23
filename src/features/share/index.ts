/**
 * Share Feature Module
 *
 * Read-only terminal sharing with time-limited links.
 */

export {
  type CreateShareOptions,
  createShareManager,
  generateSecureToken,
  hashPassword,
  parseExpiresIn,
  type ShareManager,
  type ShareState,
  type ShareStore,
  verifyPassword
} from './server/share-manager.js';
