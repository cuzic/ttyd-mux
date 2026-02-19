/**
 * Notification module - Push notifications for terminal output patterns
 */

export * from './types.js';
export * from './matcher.js';
export * from './sender.js';
export * from './subscription.js';
export * from './vapid.js';

import { createLogger } from '@/utils/logger.js';
import { createNotificationMatcher, type NotificationMatcher } from './matcher.js';
import { createNotificationSender, type NotificationSender, type SubscriptionStore } from './sender.js';
import { createSubscriptionManager, type SubscriptionManager } from './subscription.js';
import { loadOrGenerateVapidKeys } from './vapid.js';
import type { NotificationConfig, PushSubscription, VapidKeys } from './types.js';

const log = createLogger('notification');

/**
 * NotificationService - main notification system
 */
export interface NotificationService {
  /** Pattern matcher */
  matcher: NotificationMatcher;
  /** Subscription manager */
  subscriptions: SubscriptionManager;
  /** Notification sender */
  sender: NotificationSender;
  /** VAPID public key for client subscription */
  vapidPublicKey: string;
  /** Process terminal output and send notifications if patterns match */
  processOutput(sessionName: string, text: string): Promise<void>;
  /** Check if notifications are enabled */
  isEnabled(): boolean;
}

/**
 * Persistence interface for notification data
 */
export interface NotificationStore {
  getSubscriptions(): PushSubscription[];
  addSubscription(subscription: PushSubscription): void;
  removeSubscription(id: string): void;
}

/**
 * Create the notification service
 */
export function createNotificationService(
  config: NotificationConfig,
  stateDir: string,
  store: NotificationStore
): NotificationService {
  const enabled = config.enabled !== false;
  const patterns = config.patterns ?? [];
  const defaultCooldown = config.default_cooldown ?? 300;
  const contactEmail = config.contact_email ?? 'webmaster@localhost';

  // Load or generate VAPID keys
  let vapidKeys: VapidKeys;
  try {
    vapidKeys = loadOrGenerateVapidKeys(stateDir);
    log.info('VAPID keys loaded');
  } catch (error) {
    log.error(`Failed to load VAPID keys: ${String(error)}`);
    // Generate ephemeral keys
    vapidKeys = { publicKey: '', privateKey: '' };
  }

  // Create matcher
  const matcher = createNotificationMatcher({
    patterns,
    defaultCooldown
  });

  // Create subscription manager
  const subscriptions = createSubscriptionManager(store);

  // Create sender (wraps subscription manager)
  const subscriptionStore: SubscriptionStore = {
    getSubscriptions: () => store.getSubscriptions(),
    getSubscriptionsForSession: (sessionName: string) => subscriptions.getForSession(sessionName),
    removeSubscription: (id: string) => store.removeSubscription(id)
  };

  const sender = createNotificationSender(vapidKeys, contactEmail, subscriptionStore);

  return {
    matcher,
    subscriptions,
    sender,
    vapidPublicKey: vapidKeys.publicKey,

    async processOutput(sessionName: string, text: string): Promise<void> {
      if (!enabled || patterns.length === 0) {
        return;
      }

      const match = matcher.match(sessionName, text);
      if (match) {
        log.info(`Pattern matched: "${match.pattern.message}" in session ${sessionName}`);
        await sender.sendNotification(match);
      }
    },

    isEnabled(): boolean {
      return enabled && patterns.length > 0;
    }
  };
}
