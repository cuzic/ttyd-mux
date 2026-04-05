/**
 * Service Factory — Bootstrap layer
 *
 * Assembles feature services that server.ts needs.
 * This keeps features/ imports out of server.ts,
 * so server.ts only handles server startup.
 */

import { getAllPushSubscriptions, getStateDir } from '@/core/config/state.js';
import type { Config } from '@/core/config/types.js';
import type { NativeSessionManager } from '@/core/server/session-manager.js';
import { createCommandExecutorManager } from '@/core/terminal/command-executor-manager.js';
import { AgentTimelineService } from '@/features/agent-timeline/server/timeline-service.js';
import { createBlockEventEmitter } from '@/features/blocks/server/block-event-emitter.js';
import { createBlockStore } from '@/features/blocks/server/block-store.js';
import { createRedactor } from '@/features/blocks/server/output-redactor.js';
import { createNotificationSender } from '@/features/notifications/server/sender.js';
import { loadOrGenerateVapidKeys } from '@/features/notifications/server/vapid.js';
import { createLogger } from '@/utils/logger.js';

const log = createLogger('bootstrap');

export interface BootstrappedServices {
  timelineService: AgentTimelineService;
  executorManager: ReturnType<typeof createCommandExecutorManager>;
  blockEventEmitter: ReturnType<typeof createBlockEventEmitter>;
}

/**
 * Create all feature services needed by the server.
 */
export function createServices(
  config: Config,
  sessionManager: NativeSessionManager
): BootstrappedServices {
  // Notification sender
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

  // Agent timeline service (SSE streaming)
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

  // Block system
  const redactor = createRedactor({ enabled: true });
  const blockStore = createBlockStore(undefined, redactor);
  const blockEventEmitter = createBlockEventEmitter();

  // Command executor
  const executorManager = createCommandExecutorManager(sessionManager, {
    blockStore,
    eventEmitter: blockEventEmitter
  });

  return {
    timelineService,
    executorManager,
    blockEventEmitter
  };
}
