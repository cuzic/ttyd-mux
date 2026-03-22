/**
 * Notifications API Routes
 *
 * Handles push notification subscriptions and bell triggers.
 */

import { randomBytes } from 'node:crypto';
import type { ApiContext } from './types.js';
import { jsonResponse, errorResponse } from '../../utils.js';
import type { PushSubscriptionState } from '@/core/config/types.js';
import {
  addPushSubscription,
  getAllPushSubscriptions,
  getStateDir,
  removePushSubscription
} from '@/core/config/state.js';
import { getPublicVapidKey } from '@/features/notifications/server/vapid.js';
import { createLogger } from '@/utils/logger.js';

const log = createLogger('notifications-api');

/**
 * Handle notifications API routes
 */
export async function handleNotificationsRoutes(ctx: ApiContext): Promise<Response | null> {
  const { apiPath, method, req, sentryEnabled } = ctx;

  // GET /api/notifications/vapid-key
  if (apiPath === '/notifications/vapid-key' && method === 'GET') {
    try {
      const publicKey = getPublicVapidKey(getStateDir());
      return jsonResponse({ publicKey }, { sentryEnabled });
    } catch (error) {
      return errorResponse(String(error), 500, sentryEnabled);
    }
  }

  // GET /api/notifications/subscriptions
  if (apiPath === '/notifications/subscriptions' && method === 'GET') {
    const subscriptions = getAllPushSubscriptions();
    return jsonResponse(subscriptions, { sentryEnabled });
  }

  // POST /api/notifications/subscribe
  if (apiPath === '/notifications/subscribe' && method === 'POST') {
    try {
      const body = (await req.json()) as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
        sessionName?: string;
      };

      if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
        return errorResponse('endpoint and keys (p256dh, auth) are required', 400, sentryEnabled);
      }

      // Check if subscription already exists
      const existing = getAllPushSubscriptions().find((s) => s.endpoint === body.endpoint);
      if (existing) {
        return jsonResponse(existing, { sentryEnabled });
      }

      // Create new subscription
      const subscription: PushSubscriptionState = {
        id: randomBytes(8).toString('hex'),
        endpoint: body.endpoint,
        keys: body.keys,
        sessionName: body.sessionName,
        createdAt: new Date().toISOString()
      };

      addPushSubscription(subscription);
      log.info(`New subscription: ${subscription.id}`);

      return jsonResponse(subscription, { status: 201, sentryEnabled });
    } catch (error) {
      log.error(`Subscribe error: ${error}`);
      return errorResponse(String(error), 500, sentryEnabled);
    }
  }

  // DELETE /api/notifications/subscribe/:id
  const subscribeDeleteMatch = apiPath.match(/^\/notifications\/subscribe\/([^/]+)$/);
  if (subscribeDeleteMatch && method === 'DELETE') {
    const subscriptionId = subscribeDeleteMatch[1];
    if (!subscriptionId) {
      return errorResponse('Subscription ID required', 400, sentryEnabled);
    }

    const existing = getAllPushSubscriptions().find((s) => s.id === subscriptionId);
    if (!existing) {
      return errorResponse('Subscription not found', 404, sentryEnabled);
    }

    removePushSubscription(subscriptionId);
    log.info(`Subscription removed: ${subscriptionId}`);

    return jsonResponse({ success: true }, { sentryEnabled });
  }

  // POST /api/notifications/bell
  if (apiPath === '/notifications/bell' && method === 'POST') {
    try {
      const body = (await req.json()) as { sessionName: string };

      if (!body.sessionName) {
        return errorResponse('sessionName is required', 400, sentryEnabled);
      }

      const subscriptions = getAllPushSubscriptions().filter(
        (s) => !s.sessionName || s.sessionName === body.sessionName
      );

      if (subscriptions.length === 0) {
        return jsonResponse({ sent: 0, message: 'No subscriptions' }, { sentryEnabled });
      }

      log.info(`Bell triggered for session: ${body.sessionName}`);

      return jsonResponse(
        {
          success: true,
          sessionName: body.sessionName,
          subscriptionCount: subscriptions.length
        },
        { sentryEnabled }
      );
    } catch (error) {
      log.error(`Bell error: ${error}`);
      return errorResponse(String(error), 500, sentryEnabled);
    }
  }

  return null;
}
