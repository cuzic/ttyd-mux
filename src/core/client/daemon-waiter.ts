/**
 * Daemon Waiter
 *
 * Utilities for waiting for daemon state changes.
 */

import { isDaemonRunning } from './daemon-probe.js';

export const DAEMON_START_TIMEOUT = 5000;
export const DAEMON_STOP_TIMEOUT = 5000;
const DAEMON_CHECK_INTERVAL = 100;

/**
 * Wait for daemon to become ready
 * Uses setInterval to keep the event loop alive during the wait
 */
export async function waitForDaemon(): Promise<boolean> {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const check = async () => {
      if (Date.now() - startTime >= DAEMON_START_TIMEOUT) {
        clearInterval(intervalId);
        resolve(false);
        return;
      }

      const running = await isDaemonRunning();
      if (running) {
        clearInterval(intervalId);
        resolve(true);
      }
    };

    // Use setInterval to keep the event loop alive
    const intervalId = setInterval(check, DAEMON_CHECK_INTERVAL);
    // Run the first check immediately
    check();
  });
}

/**
 * Wait for daemon to stop
 * Uses setInterval to keep the event loop alive during the wait
 */
export async function waitForDaemonStop(): Promise<boolean> {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const check = async () => {
      if (Date.now() - startTime >= DAEMON_STOP_TIMEOUT) {
        clearInterval(intervalId);
        resolve(false);
        return;
      }

      const running = await isDaemonRunning();
      if (!running) {
        clearInterval(intervalId);
        resolve(true);
      }
    };

    // Use setInterval to keep the event loop alive
    const intervalId = setInterval(check, DAEMON_CHECK_INTERVAL);
    // Run the first check immediately
    check();
  });
}
