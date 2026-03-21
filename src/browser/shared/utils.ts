/**
 * Toolbar Client Utilities
 *
 * Shared utility functions for toolbar client modules.
 */

import type { Scope } from './lifecycle.js';

/** Mobile device detection regex (top-level for performance) */
const MOBILE_REGEX = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

/**
 * Check if the current device is a mobile device
 */
export const isMobileDevice = (): boolean => MOBILE_REGEX.test(navigator.userAgent);

/**
 * Extract session name from URL path
 * @param basePath - The base path prefix (e.g., '/bunterm')
 * @returns Session name or empty string if not found
 */
export function getSessionNameFromURL(basePath: string): string {
  // Normalize basePath: remove leading/trailing slashes
  const normalizedBase = basePath.replace(/^\/|\/$/g, '');
  const pathname = window.location.pathname;

  // Match pattern: /<basePath>/<sessionName>/...
  const pattern = new RegExp(`^/${normalizedBase}/([^/]+)`);
  const match = pathname.match(pattern);

  return match?.[1] ?? '';
}

/**
 * Bind a click event handler to an element with automatic cleanup via Scope.
 * @param scope - Scope for automatic cleanup
 * @param element - The element to bind to (null-safe)
 * @param handler - The click handler function
 */
export function bindClickScoped(
  scope: Scope,
  element: HTMLElement | null,
  handler: (e?: MouseEvent) => void
): void {
  if (!element) {
    return;
  }

  scope.on(element, 'click', (e: Event) => {
    e.preventDefault();
    handler(e as MouseEvent);
  });
}

/**
 * Truncate text to a maximum length with ellipsis
 * @param text - The text to truncate
 * @param maxLength - Maximum length before truncation
 * @param suffix - Suffix to append when truncated (default: '...')
 * @returns Truncated text
 */
export function truncateText(text: string, maxLength: number, suffix = '...'): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - suffix.length) + suffix;
}

/** Default preview allowed extensions (fallback if not provided by server) */
const DEFAULT_PREVIEW_EXTENSIONS = ['.html', '.htm', '.md', '.txt'];

/**
 * Check if a file is previewable based on its extension
 * @param filename - The filename to check
 * @param allowedExtensions - Array of allowed extensions (uses default if not provided)
 * @returns True if the file is previewable
 */
export function isPreviewable(filename: string, allowedExtensions?: string[]): boolean {
  const extensions = allowedExtensions ?? DEFAULT_PREVIEW_EXTENSIONS;
  const lowerName = filename.toLowerCase();
  return extensions.some((ext) => lowerName.endsWith(ext.toLowerCase()));
}

/**
 * Convert a Blob to base64 string
 * @param blob - The blob to convert
 * @returns Base64 encoded string
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  return btoa(
    new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
  );
}

/**
 * Copy text to clipboard with consistent error handling
 * @param text - The text to copy
 * @returns True if copy succeeded, false otherwise
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!navigator.clipboard) {
    console.warn('Clipboard API not available');
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Read text from clipboard
 * @returns Clipboard text or null if failed
 */
export async function readClipboardText(): Promise<string | null> {
  if (!navigator.clipboard) {
    console.warn('Clipboard API not available');
    return null;
  }
  try {
    return await navigator.clipboard.readText();
  } catch (error) {
    console.error('Failed to read clipboard:', error);
    return null;
  }
}

/**
 * Escape HTML special characters using string replacement
 * More efficient than DOM-based escaping
 * @param text - The text to escape
 * @returns Escaped HTML string
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Locale type for relative time formatting
 */
export type TimeLocale = 'en' | 'ja';

/**
 * Format a date as relative time (e.g., "2分前", "1 hour ago")
 * @param isoString - ISO date string
 * @param locale - Locale for labels ('en' or 'ja')
 * @returns Formatted relative time string
 */
export function formatRelativeTime(isoString: string, locale: TimeLocale = 'ja'): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  const labels = {
    en: {
      now: 'just now',
      min: (n: number) => `${n}m ago`,
      hour: (n: number) => `${n}h ago`,
      day: (n: number) => `${n}d ago`
    },
    ja: {
      now: 'たった今',
      min: (n: number) => `${n}分前`,
      hour: (n: number) => `${n}時間前`,
      day: (n: number) => `${n}日前`
    }
  };

  const l = labels[locale];

  if (diffSec < 60) {
    return l.now;
  }
  if (diffMin < 60) {
    return l.min(diffMin);
  }
  if (diffHour < 24) {
    return l.hour(diffHour);
  }
  if (diffDay < 7) {
    return l.day(diffDay);
  }

  // For older dates, show the date
  if (locale === 'ja') {
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString();
}

/**
 * Generate a unique ID string
 * @returns Unique ID in format: timestamp-randomstring
 */
export function generateUniqueId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Format file size in human-readable format
 * @param bytes - Size in bytes
 * @returns Formatted size string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / 1024 ** i;
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Bind backdrop click handler to close a modal
 * Closes the modal when clicking the backdrop (modal element itself, not its contents)
 * @param scope - Scope for automatic cleanup
 * @param modal - The modal element
 * @param onClose - Callback to close the modal
 */
export function bindBackdropClose(
  scope: Scope,
  modal: HTMLElement | null,
  onClose: () => void
): void {
  if (!modal) {
    return;
  }
  scope.on(modal, 'click', (e: Event) => {
    if (e.target === modal) {
      onClose();
    }
  });
}

/** Long press duration in milliseconds */
const LONG_PRESS_DURATION = 500;

/**
 * Setup long press detection on an element
 * Supports both pointer events (desktop) and touch events (mobile)
 * @param scope - Scope for automatic cleanup
 * @param element - Element to detect long press on
 * @param onLongPress - Callback when long press is detected
 * @param duration - Duration in ms to trigger long press (default: 500)
 * @returns Object with isLongPress() method to check if last interaction was a long press
 */
export function setupLongPress(
  scope: Scope,
  element: HTMLElement | null,
  onLongPress: () => void,
  duration = LONG_PRESS_DURATION
): { isLongPress: () => boolean } {
  if (!element) {
    return { isLongPress: () => false };
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  let longPressTriggered = false;

  const start = () => {
    longPressTriggered = false;
    timer = setTimeout(() => {
      longPressTriggered = true;
      onLongPress();
    }, duration);
  };

  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  // Pointer events (covers mouse and touch on modern browsers)
  scope.on(element, 'pointerdown', start);
  scope.on(element, 'pointerup', cancel);
  scope.on(element, 'pointercancel', cancel);
  scope.on(element, 'pointerleave', cancel);

  return {
    isLongPress: () => longPressTriggered
  };
}
