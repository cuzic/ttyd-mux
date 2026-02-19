/**
 * Notification Manager
 *
 * Handles Web Push notification subscription and management.
 */

import { z } from 'zod';
import { createApiClient, type ToolbarApiClient } from './ApiClient.js';
import { createStorageManager, type StorageManager } from './StorageManager.js';
import type { ToolbarConfig } from './types.js';
import { STORAGE_KEYS } from './types.js';
import { getSessionNameFromURL } from './utils.js';

// Schema for notification subscription storage
const subscriptionSchema = z
  .object({
    id: z.string()
  })
  .nullable();

type SubscriptionData = { id: string } | null;

export class NotificationManager {
  private config: ToolbarConfig;
  private apiClient: ToolbarApiClient;
  private subscribed = false;
  private subscriptionId: string | null = null;
  private notifyBtn: HTMLElement | null = null;
  private storage: StorageManager<SubscriptionData>;

  constructor(config: ToolbarConfig) {
    this.config = config;
    this.apiClient = createApiClient({ basePath: config.base_path });
    this.storage = createStorageManager({
      key: STORAGE_KEYS.NOTIFY_SUBSCRIPTION,
      schema: subscriptionSchema,
      defaultValue: null
    });
    this.loadSubscription();
  }

  /**
   * Bind notification button element
   */
  bindElement(notifyBtn: HTMLElement): void {
    this.notifyBtn = notifyBtn;
    this.updateButton();
  }

  /**
   * Get session name from URL
   */
  private getSessionName(): string {
    return getSessionNameFromURL(this.config.base_path);
  }

  /**
   * Convert base64 to Uint8Array for applicationServerKey
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Load saved subscription ID from storage
   */
  private loadSubscription(): void {
    const data = this.storage.load();
    if (data) {
      this.subscriptionId = data.id;
      this.subscribed = true;
      console.log('[Toolbar] Loaded notification subscription: ' + data.id);
    }
  }

  /**
   * Save subscription ID to storage
   */
  private saveSubscription(id: string): void {
    this.storage.save({ id });
  }

  /**
   * Clear subscription from storage
   */
  private clearSubscription(): void {
    this.storage.clear();
  }

  /**
   * Update button appearance based on subscription state
   */
  updateButton(): void {
    if (!this.notifyBtn) return;

    if (this.subscribed) {
      this.notifyBtn.classList.add('active');
      this.notifyBtn.textContent = '\u{1F514}'; // 🔔
      this.notifyBtn.title = 'Push通知: ON (クリックで解除)';
    } else {
      this.notifyBtn.classList.remove('active');
      this.notifyBtn.textContent = '\u{1F515}'; // 🔕
      this.notifyBtn.title = 'Push通知: OFF (クリックで有効化)';
    }
  }

  /**
   * Check if subscribed
   */
  isSubscribed(): boolean {
    return this.subscribed;
  }

  /**
   * Subscribe to push notifications
   */
  async subscribe(): Promise<void> {
    const sessionName = this.getSessionName();

    try {
      // Check if service worker is supported
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        alert('このブラウザはPush通知をサポートしていません');
        return;
      }

      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('通知の許可が必要です');
        return;
      }

      // Get VAPID public key from server
      const publicKey = await this.apiClient.getVapidKey();

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(publicKey) as BufferSource
      });

      // Extract keys
      const p256dh = subscription.getKey('p256dh');
      const auth = subscription.getKey('auth');

      if (!p256dh || !auth) {
        throw new Error('Failed to get subscription keys');
      }

      // Send subscription to server
      const subscriptionId = await this.apiClient.subscribe({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dh)))),
          auth: btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(auth))))
        },
        sessionName: sessionName || undefined
      });

      this.subscriptionId = subscriptionId;
      this.subscribed = true;
      this.saveSubscription(subscriptionId);
      this.updateButton();
      console.log('[Toolbar] Push notification subscribed: ' + subscriptionId);
    } catch (error) {
      console.error('[Toolbar] Push notification subscription failed:', error);
      alert('Push通知の登録に失敗しました: ' + (error as Error).message);
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<void> {
    try {
      if (this.subscriptionId) {
        await this.apiClient.unsubscribe(this.subscriptionId);
      }

      // Also unsubscribe from browser
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }

      this.subscribed = false;
      this.subscriptionId = null;
      this.clearSubscription();
      this.updateButton();
      console.log('[Toolbar] Push notification unsubscribed');
    } catch (error) {
      console.error('[Toolbar] Push notification unsubscribe failed:', error);
    }
  }

  /**
   * Toggle notification subscription
   */
  async toggle(): Promise<void> {
    if (this.subscribed) {
      await this.unsubscribe();
    } else {
      await this.subscribe();
    }
  }
}
