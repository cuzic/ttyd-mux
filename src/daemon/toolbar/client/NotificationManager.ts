/**
 * Notification Manager
 *
 * Handles Web Push notification subscription and management.
 */

import type { ToolbarConfig } from './types.js';
import { STORAGE_KEYS } from './types.js';

export class NotificationManager {
  private config: ToolbarConfig;
  private subscribed = false;
  private subscriptionId: string | null = null;
  private notifyBtn: HTMLElement | null = null;

  constructor(config: ToolbarConfig) {
    this.config = config;
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
    const pathParts = window.location.pathname.split('/');
    return pathParts[2] || '';
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
   * Load saved subscription ID from localStorage
   */
  private loadSubscription(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.NOTIFY_SUBSCRIPTION);
      if (saved) {
        const data = JSON.parse(saved);
        this.subscriptionId = data.id;
        this.subscribed = true;
        console.log('[Toolbar] Loaded notification subscription: ' + data.id);
      }
    } catch (e) {
      console.warn('[Toolbar] Failed to load notification subscription:', e);
    }
  }

  /**
   * Save subscription ID to localStorage
   */
  private saveSubscription(id: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.NOTIFY_SUBSCRIPTION, JSON.stringify({ id }));
    } catch (e) {
      console.warn('[Toolbar] Failed to save notification subscription:', e);
    }
  }

  /**
   * Clear subscription from localStorage
   */
  private clearSubscription(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.NOTIFY_SUBSCRIPTION);
    } catch (e) {
      console.warn('[Toolbar] Failed to clear notification subscription:', e);
    }
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
    const basePath = this.config.base_path;
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
      const vapidResponse = await fetch(basePath + '/api/notifications/vapid-key');
      if (!vapidResponse.ok) {
        throw new Error('VAPID key fetch failed');
      }
      const { publicKey } = await vapidResponse.json();

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
      const response = await fetch(basePath + '/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dh)))),
            auth: btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(auth))))
          },
          sessionName: sessionName || undefined
        })
      });

      if (!response.ok) {
        throw new Error('Subscription failed');
      }

      const result = await response.json();
      this.subscriptionId = result.id;
      this.subscribed = true;
      this.saveSubscription(result.id);
      this.updateButton();
      console.log('[Toolbar] Push notification subscribed: ' + result.id);
    } catch (error) {
      console.error('[Toolbar] Push notification subscription failed:', error);
      alert('Push通知の登録に失敗しました: ' + (error as Error).message);
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<void> {
    const basePath = this.config.base_path;

    try {
      if (this.subscriptionId) {
        await fetch(
          basePath + '/api/notifications/subscribe/' + encodeURIComponent(this.subscriptionId),
          { method: 'DELETE' }
        );
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
