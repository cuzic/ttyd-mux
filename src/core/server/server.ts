/**
 * Native Terminal Server
 *
 * Elysia-based HTTP/WebSocket server for native terminal mode.
 * All routes, middleware, and WebSocket handlers are registered in the Elysia app.
 */

import { getAllPushSubscriptions, getStateDir } from '@/core/config/state.js';
import type { Config } from '@/core/config/types.js';
import { createElysiaApp } from '@/core/server/elysia/app.js';
import { rateLimiterPlugin } from '@/core/server/elysia/middleware/rate-limiter.js';
import { NativeSessionManager } from '@/core/server/session-manager.js';
import { createCommandExecutorManager } from '@/core/terminal/command-executor-manager.js';
import { AgentTimelineService } from '@/features/agent-timeline/server/timeline-service.js';
import { createBlockEventEmitter } from '@/features/blocks/server/block-event-emitter.js';
import { createBlockStore } from '@/features/blocks/server/block-store.js';
import { createRedactor } from '@/features/blocks/server/output-redactor.js';
import { createNotificationSender } from '@/features/notifications/server/sender.js';
import { loadOrGenerateVapidKeys } from '@/features/notifications/server/vapid.js';
import { createLogger } from '@/utils/logger.js';

const log = createLogger('native-server');

export interface NativeTerminalServerOptions {
  config: Config;
  getConfig: () => Config;
  cookieSessionStore?: import('@/core/server/auth/cookie-session.js').CookieSessionStore | null;
  shareManager?: import('@/features/share/server/share-manager.js').ShareManager | null;
}

export interface NativeTerminalServer {
  sessionManager: NativeSessionManager;
  stop: () => Promise<void>;
}

/**
 * Create a native terminal server using Elysia
 */
export function createNativeTerminalServer(
  options: NativeTerminalServerOptions
): NativeTerminalServer {
  const { config } = options;
  const sessionManager = new NativeSessionManager(config);

  // Initialize push notification sender for agent error events
  const stateDir = getStateDir();
  const vapidKeys = loadOrGenerateVapidKeys(stateDir);
  const contactEmail = config.notifications?.contact_email ?? 'webmaster@localhost';
  const notificationSender = createNotificationSender(vapidKeys, contactEmail, {
    getSubscriptions: () => getAllPushSubscriptions(),
    getSubscriptionsForSession: (sessionName) =>
      getAllPushSubscriptions().filter((s) => !s.sessionName || s.sessionName === sessionName),
    removeSubscription: (_id) => {
      // Removal handled by notifications plugin
    }
  });

  // Initialize agent timeline service for SSE streaming
  const timelineService = new AgentTimelineService({
    sessionManager,
    onErrorEvent: (event) => {
      notificationSender
        .sendNotification({
          pattern: {
            regex: '',
            message: `[bunterm] Agent Error: ${event.agentName}`
          },
          matchedText: event.summary,
          sessionName: event.agentName,
          timestamp: event.timestamp
        })
        .catch((error) => {
          log.error(`Failed to send error notification: ${String(error)}`);
        });
    }
  });
  // Initialize command executor and block event emitter
  const redactor = createRedactor({ enabled: true });
  const blockStore = createBlockStore(undefined, redactor);
  const blockEventEmitter = createBlockEventEmitter();
  const executorManager = createCommandExecutorManager(sessionManager, {
    blockStore,
    eventEmitter: blockEventEmitter
  });

  // Create and start the Elysia app (rate limiter added here, not in createElysiaApp, to avoid affecting tests)
  const app = createElysiaApp({
    sessionManager,
    config,
    timelineService,
    executorManager,
    blockEventEmitter,
    cookieSessionStore: options.cookieSessionStore ?? null,
    shareManager: options.shareManager ?? null
  }).use(rateLimiterPlugin);

  app.listen({
    port: config.daemon_port,
    hostname: config.listen_addresses[0] || '127.0.0.1'
  });

  log.info(`Native terminal server started on ${config.listen_addresses[0]}:${config.daemon_port}`);

  return {
    sessionManager,
    async stop() {
      timelineService.dispose();
      await sessionManager.stopAll();
      app.stop();
    }
  };
}
