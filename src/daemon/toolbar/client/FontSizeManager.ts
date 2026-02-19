/**
 * Font Size Manager
 *
 * Handles font size persistence to localStorage.
 */

import type { ToolbarConfig } from './types.js';
import { STORAGE_KEYS } from './types.js';

export class FontSizeManager {
  private config: ToolbarConfig;

  constructor(config: ToolbarConfig) {
    this.config = config;
  }

  /**
   * Save font size to localStorage
   */
  save(size: number): void {
    try {
      localStorage.setItem(STORAGE_KEYS.FONT_SIZE, String(size));
    } catch (e) {
      console.warn('[Toolbar] Failed to save font size:', e);
    }
  }

  /**
   * Load font size from localStorage
   */
  load(): number {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    const defaultSize = isMobile
      ? this.config.font_size_default_mobile
      : this.config.font_size_default_pc;

    try {
      const saved = localStorage.getItem(STORAGE_KEYS.FONT_SIZE);
      if (saved) {
        const size = parseInt(saved, 10);
        if (!isNaN(size) && size >= this.config.font_size_min && size <= this.config.font_size_max) {
          return size;
        }
      }
    } catch (e) {
      console.warn('[Toolbar] Failed to load font size:', e);
    }

    return defaultSize;
  }
}
