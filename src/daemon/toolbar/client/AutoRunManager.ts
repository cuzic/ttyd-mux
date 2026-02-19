/**
 * Auto Run Manager
 *
 * Manages auto-run mode state persistence.
 */

import { STORAGE_KEYS } from './types.js';

export class AutoRunManager {
  private active = false;
  private autoBtn: HTMLElement | null = null;

  /**
   * Bind auto-run button element
   */
  bindElement(autoBtn: HTMLElement): void {
    this.autoBtn = autoBtn;
    this.restore();
  }

  /**
   * Check if auto-run is active
   */
  isActive(): boolean {
    return this.active;
  }

  /**
   * Toggle auto-run mode
   */
  toggle(): boolean {
    this.active = !this.active;
    this.autoBtn?.classList.toggle('active', this.active);
    this.save();
    return this.active;
  }

  /**
   * Save auto-run state to localStorage
   */
  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.AUTO_RUN, this.active ? '1' : '0');
    } catch (e) {
      console.warn('[Toolbar] Failed to save auto-run state:', e);
    }
  }

  /**
   * Restore auto-run state from localStorage
   */
  private restore(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AUTO_RUN);
      if (saved === '1') {
        this.active = true;
        this.autoBtn?.classList.add('active');
        console.log('[Toolbar] Restored auto-run mode: enabled');
      }
    } catch (e) {
      console.warn('[Toolbar] Failed to load auto-run state:', e);
    }
  }
}
