/**
 * Push subscription management
 */

import { randomBytes } from 'node:crypto';
import type { PushSubscription } from './types.js';

/**
 * Subscription store with persistence
 */
export interface SubscriptionStoreConfig {
  getSubscriptions(): PushSubscription[];
  addSubscription(subscription: PushSubscription): void;
  removeSubscription(id: string): void;
}

/**
 * Subscription manager interface
 */
export interface SubscriptionManager {
  /** Add a new subscription */
  subscribe(endpoint: string, keys: { p256dh: string; auth: string }, sessionName?: string): PushSubscription;
  /** Remove a subscription by ID */
  unsubscribe(id: string): boolean;
  /** Get all subscriptions */
  getAll(): PushSubscription[];
  /** Get subscriptions for a specific session (includes global subscriptions) */
  getForSession(sessionName: string): PushSubscription[];
  /** Check if a subscription exists by endpoint */
  hasSubscription(endpoint: string): boolean;
}

/**
 * Generate a subscription ID
 */
function generateSubscriptionId(): string {
  return randomBytes(8).toString('hex');
}

/**
 * Create a subscription manager
 */
export function createSubscriptionManager(store: SubscriptionStoreConfig): SubscriptionManager {
  return {
    subscribe(
      endpoint: string,
      keys: { p256dh: string; auth: string },
      sessionName?: string
    ): PushSubscription {
      // Check if already subscribed
      const existing = store.getSubscriptions().find((s) => s.endpoint === endpoint);
      if (existing) {
        return existing;
      }

      const subscription: PushSubscription = {
        id: generateSubscriptionId(),
        endpoint,
        keys,
        sessionName,
        createdAt: new Date().toISOString()
      };

      store.addSubscription(subscription);
      return subscription;
    },

    unsubscribe(id: string): boolean {
      const subscriptions = store.getSubscriptions();
      const exists = subscriptions.some((s) => s.id === id);
      if (exists) {
        store.removeSubscription(id);
        return true;
      }
      return false;
    },

    getAll(): PushSubscription[] {
      return store.getSubscriptions();
    },

    getForSession(sessionName: string): PushSubscription[] {
      return store.getSubscriptions().filter(
        (s) => !s.sessionName || s.sessionName === sessionName
      );
    },

    hasSubscription(endpoint: string): boolean {
      return store.getSubscriptions().some((s) => s.endpoint === endpoint);
    }
  };
}
