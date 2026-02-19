/**
 * Push notification sender
 */

import webpush from 'web-push';
import { createLogger } from '@/utils/logger.js';
import type { MatchResult, PushSubscription, VapidKeys } from './types.js';

const log = createLogger('notification');

/**
 * Notification payload sent to client
 */
export interface NotificationPayload {
  title: string;
  body: string;
  sessionName: string;
  matchedText: string;
  timestamp: string;
  icon?: string;
  tag?: string;
}

/**
 * Subscription store interface
 */
export interface SubscriptionStore {
  getSubscriptions(): PushSubscription[];
  getSubscriptionsForSession(sessionName: string): PushSubscription[];
  removeSubscription(id: string): void;
}

/**
 * NotificationSender interface
 */
export interface NotificationSender {
  /** Send notification to all relevant subscribers */
  sendNotification(match: MatchResult): Promise<number>;
  /** Send notification to a specific subscription */
  sendToSubscription(subscription: PushSubscription, payload: NotificationPayload): Promise<boolean>;
}

/**
 * Create a notification sender
 */
export function createNotificationSender(
  vapidKeys: VapidKeys,
  contactEmail: string,
  store: SubscriptionStore
): NotificationSender {
  // Configure web-push with VAPID details
  webpush.setVapidDetails(`mailto:${contactEmail}`, vapidKeys.publicKey, vapidKeys.privateKey);

  return {
    async sendNotification(match: MatchResult): Promise<number> {
      const payload: NotificationPayload = {
        title: match.pattern.message,
        body: match.matchedText.slice(0, 200), // Truncate long text
        sessionName: match.sessionName,
        matchedText: match.matchedText,
        timestamp: match.timestamp,
        tag: `ttyd-mux-${match.sessionName}`
      };

      // Get subscriptions for this session (or all if no session filter)
      const subscriptions = store.getSubscriptionsForSession(match.sessionName);

      if (subscriptions.length === 0) {
        log.debug(`No subscriptions for session: ${match.sessionName}`);
        return 0;
      }

      let sent = 0;
      const invalidSubscriptions: string[] = [];

      for (const subscription of subscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: subscription.keys
            },
            JSON.stringify(payload)
          );
          sent++;
          log.debug(`Sent notification to subscription: ${subscription.id}`);
        } catch (error) {
          const err = error as { statusCode?: number };
          if (err.statusCode === 410 || err.statusCode === 404) {
            // Subscription no longer valid
            invalidSubscriptions.push(subscription.id);
            log.debug(`Subscription expired: ${subscription.id}`);
          } else {
            log.error(`Failed to send notification: ${String(error)}`);
          }
        }
      }

      // Remove invalid subscriptions
      for (const id of invalidSubscriptions) {
        store.removeSubscription(id);
      }

      log.info(`Sent ${sent}/${subscriptions.length} notifications for pattern: ${match.pattern.message}`);
      return sent;
    },

    async sendToSubscription(subscription: PushSubscription, payload: NotificationPayload): Promise<boolean> {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: subscription.keys
          },
          JSON.stringify(payload)
        );
        return true;
      } catch (error) {
        log.error(`Failed to send notification: ${String(error)}`);
        return false;
      }
    }
  };
}
