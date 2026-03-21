/**
 * BaseModal
 *
 * Abstract base class for modal dialogs.
 * Implements Mountable for automatic cleanup via Scope.
 * Handles show/hide, backdrop close, and visibility state.
 *
 * Supports two initialization patterns:
 * 1. Immediate: Pass modal in constructor config
 * 2. Deferred: Call bindModal() after construction (for bindElements() pattern)
 */

import type { KeyRouter } from './key-router.js';
import type { Mountable, Scope } from './lifecycle.js';
import { bindClickScoped } from './utils.js';

/** Configuration for BaseModal */
export interface ModalConfig {
  /** The modal element (optional for deferred binding) */
  modal?: HTMLElement;
  /** Optional close button */
  closeBtn?: HTMLElement | null;
  /** Enable backdrop click to close (default: true) */
  backdropClose?: boolean;
  /** KeyRouter for Escape key handling (optional, handled by KeyRouter centrally) */
  keyRouter?: KeyRouter;
  /** Key priority for Escape handler */
  keyPriority?: number;
}

/**
 * Abstract base class for modal dialogs.
 * Provides common show/hide/visibility functionality.
 */
export abstract class BaseModal implements Mountable {
  protected modal: HTMLElement | null = null;
  protected closeBtn: HTMLElement | null = null;
  protected backdropClose: boolean;
  protected keyRouter?: KeyRouter;
  protected keyPriority?: number;
  protected visible = false;

  constructor(config: ModalConfig = {}) {
    this.modal = config.modal ?? null;
    this.closeBtn = config.closeBtn ?? null;
    this.backdropClose = config.backdropClose ?? true;
    this.keyRouter = config.keyRouter;
    this.keyPriority = config.keyPriority;
  }

  /**
   * Bind modal element (for deferred initialization pattern)
   */
  protected bindModal(modal: HTMLElement, closeBtn?: HTMLElement | null): void {
    this.modal = modal;
    if (closeBtn !== undefined) {
      this.closeBtn = closeBtn;
    }
  }

  /**
   * Mount event listeners to scope for automatic cleanup
   */
  mount(scope: Scope): void {
    if (!this.modal) {
      return;
    }

    // Close button binding
    if (this.closeBtn) {
      bindClickScoped(scope, this.closeBtn, () => this.hide());
    }

    // Backdrop close
    if (this.backdropClose) {
      scope.on(this.modal, 'click', (e: Event) => {
        if (e.target === this.modal) {
          this.hide();
        }
      });
    }

    // Escape via KeyRouter (if provided and not handled centrally)
    if (this.keyRouter && this.keyPriority !== undefined) {
      scope.add(
        this.keyRouter.register((e) => {
          if (e.key === 'Escape' && this.isVisible()) {
            e.preventDefault();
            this.hide();
            return true;
          }
          return false;
        }, this.keyPriority)
      );
    }

    // Call subclass mount hook
    this.onMount(scope);
  }

  /**
   * Show the modal
   */
  show(): void {
    if (!this.modal) {
      return;
    }
    this.visible = true;
    this.modal.classList.remove('hidden');
    this.onShow();
  }

  /**
   * Hide the modal
   */
  hide(): void {
    if (!this.modal) {
      return;
    }
    this.visible = false;
    this.modal.classList.add('hidden');
    this.onHide();
  }

  /**
   * Check if modal is visible
   */
  isVisible(): boolean {
    return this.visible;
  }

  /**
   * Toggle modal visibility
   */
  toggle(show?: boolean): void {
    if (show !== undefined) {
      show ? this.show() : this.hide();
    } else {
      this.isVisible() ? this.hide() : this.show();
    }
  }

  /**
   * Hook called during mount - override in subclasses
   */
  protected onMount(_scope: Scope): void {}

  /**
   * Hook called when modal is shown - override in subclasses
   */
  protected onShow(): void {}

  /**
   * Hook called when modal is hidden - override in subclasses
   */
  protected onHide(): void {}
}
