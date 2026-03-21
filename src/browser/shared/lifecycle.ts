/**
 * Lifecycle Management
 *
 * Provides unified subscription management for DOM events and EventBus.
 * Use Scope's curried methods for cleaner syntax:
 *
 * @example
 * ```typescript
 * const scope = new Scope();
 *
 * // DOM events
 * scope.on(element, 'click', handler);
 *
 * // EventBus subscriptions
 * scope.onBus(bus, 'event', handler);
 *
 * // Mount Mountable components
 * scope.mount(component);
 *
 * // Cleanup all subscriptions
 * scope.close();
 * ```
 */

import type { Handler } from 'mitt';

/**
 * Cleanup function type.
 * Functions that clean up resources when called.
 */
export type DisposeFn = () => void;

/** No-op disposable for already-closed scopes */
const noop: DisposeFn = () => undefined;

/**
 * Scope for managing multiple disposables.
 * Collects cleanup functions and disposes them in LIFO order.
 * Implements Symbol.dispose for use with `using` declarations.
 *
 * Preferred methods:
 * - `scope.on(target, type, handler)` - DOM event listener
 * - `scope.onBus(bus, type, handler)` - EventBus subscription
 * - `scope.mount(component)` - Mount Mountable component
 * - `scope.add(disposable)` - Add custom cleanup function
 *
 * @example
 * ```typescript
 * // Automatic cleanup with `using`
 * {
 *   using scope = new Scope();
 *   scope.on(element, 'click', handler);
 * } // scope automatically closed here
 * ```
 */
export class Scope implements Disposable {
  private disposables: DisposeFn[] = [];
  private closed = false;

  /**
   * Add a disposable to this scope.
   * If scope is already closed, the disposable is called immediately.
   * @returns The same disposable for chaining
   */
  add(d: DisposeFn): DisposeFn {
    if (this.closed) {
      d();
      return noop;
    }
    this.disposables.push(d);
    return d;
  }

  /**
   * Add a DOM event listener with automatic cleanup.
   */
  on(
    target: EventTarget,
    type: string,
    handler: EventListenerOrEventListenerObject,
    options: AddEventListenerOptions = {}
  ): DisposeFn {
    const controller = new AbortController();
    target.addEventListener(type, handler, { ...options, signal: controller.signal });
    return this.add(() => controller.abort());
  }

  /**
   * Subscribe to an EventBus event with automatic cleanup.
   */
  onBus<T extends Record<string, unknown>, K extends keyof T>(
    bus: EventBus<T>,
    type: K,
    handler: Handler<T[K]>
  ): DisposeFn {
    bus.on(type, handler);
    return this.add(() => bus.off(type, handler));
  }

  /**
   * Mount a Mountable component to this scope.
   */
  mount(mountable: Mountable): void {
    mountable.mount(this);
  }

  /**
   * Close the scope and dispose all collected disposables in LIFO order.
   * After closing, any new disposables added will be called immediately.
   */
  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    // LIFO order for proper dependency cleanup
    for (let i = this.disposables.length - 1; i >= 0; i--) {
      try {
        this.disposables[i]();
      } catch {
        // Ignore errors during cleanup
      }
    }
    this.disposables = [];
  }

  /**
   * Check if the scope is closed
   */
  isClosed(): boolean {
    return this.closed;
  }

  /**
   * Create a child scope that is automatically closed when this scope closes.
   */
  createChild(): Scope {
    const child = new Scope();
    this.add(() => child.close());
    return child;
  }

  /**
   * Dispose the scope (alias for close).
   * Implements Symbol.dispose for use with `using` declarations.
   */
  [Symbol.dispose](): void {
    this.close();
  }
}

/**
 * Add a DOM event listener with automatic cleanup via AbortController.
 * @deprecated Use `scope.on(target, type, handler)` instead.
 */
export function on(
  target: EventTarget,
  type: string,
  handler: EventListenerOrEventListenerObject,
  options: AddEventListenerOptions = {}
): DisposeFn {
  const controller = new AbortController();
  target.addEventListener(type, handler, { ...options, signal: controller.signal });
  return () => controller.abort();
}

/**
 * Bus interface for mitt-like event emitters
 */
export interface EventBus<T extends Record<string, unknown>> {
  on<K extends keyof T>(type: K, handler: Handler<T[K]>): void;
  off<K extends keyof T>(type: K, handler: Handler<T[K]>): void;
}

/**
 * Subscribe to an EventBus event with automatic cleanup.
 * @deprecated Use `scope.onBus(bus, type, handler)` instead.
 */
export function onBus<T extends Record<string, unknown>, K extends keyof T>(
  bus: EventBus<T>,
  type: K,
  handler: Handler<T[K]>
): DisposeFn {
  bus.on(type, handler);
  return () => bus.off(type, handler);
}

/**
 * Mountable interface for components that can be mounted to a scope.
 * Components implementing this interface register their event listeners
 * via the provided scope for automatic cleanup.
 */
export interface Mountable {
  /**
   * Mount the component, registering all event listeners via the scope.
   * @param scope - Scope to register cleanup functions
   */
  mount(scope: Scope): void;
}
