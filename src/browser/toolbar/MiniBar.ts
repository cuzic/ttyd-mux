/**
 * MiniBar
 *
 * A compact floating toolbar shown on mobile when the full toolbar
 * is hidden. Displays context-appropriate buttons based on terminal state.
 */

import { type Mountable, Scope } from '@/browser/shared/lifecycle.js';
import type { TerminalState, TerminalStateTracker } from './TerminalStateTracker.js';

export interface MiniBarActions {
  sendArrowUp(): void;
  sendTab(): void;
  openSnippet(): void;
  expandToolbar(): void;
  sendCtrlC(): void;
  toggleSearch(): void;
  goToAgents(): void;
  copySelection(): void;
}

export class MiniBar implements Mountable {
  private el: HTMLElement;
  private stateTracker: TerminalStateTracker;
  private actions: MiniBarActions;
  private renderScope: Scope | null = null;

  constructor(stateTracker: TerminalStateTracker, actions: MiniBarActions) {
    this.stateTracker = stateTracker;
    this.actions = actions;
    this.el = this.createElement();
  }

  mount(scope: Scope): void {
    document.body.appendChild(this.el);
    scope.add(() => {
      this.renderScope?.close();
      this.renderScope = null;
      this.el.remove();
    });

    const unsubscribe = this.stateTracker.onChange((state) => this.render(state));
    scope.add(unsubscribe);

    this.render(this.stateTracker.state);
  }

  show(): void {
    this.el.style.display = 'flex';
  }

  hide(): void {
    this.el.style.display = 'none';
  }

  private createElement(): HTMLElement {
    const el = document.createElement('div');
    el.id = 'minibar';
    el.style.cssText = `
      position: fixed; right: 12px; bottom: 12px; z-index: 1000;
      display: none; gap: 6px; align-items: center;
      background: rgba(30, 30, 30, 0.85); backdrop-filter: blur(8px);
      border-radius: 20px; padding: 4px 8px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.4);
      font-size: 14px; user-select: none;
      -webkit-user-select: none;
    `;
    return el;
  }

  private render(state: TerminalState): void {
    this.renderScope?.close();
    this.renderScope = new Scope();
    this.el.innerHTML = '';
    const buttons = this.getButtonsForState(state, this.renderScope);
    for (const btn of buttons) {
      this.el.appendChild(btn);
    }
  }

  private getButtonsForState(state: TerminalState, scope: Scope): HTMLElement[] {
    switch (state) {
      case 'idle':
        return [
          this.btn('↑', () => this.actions.sendArrowUp(), scope),
          this.btn('Tab', () => this.actions.sendTab(), scope),
          this.btn('📝', () => this.actions.openSnippet(), scope),
          this.btn('≡', () => this.actions.expandToolbar(), scope)
        ];
      case 'busy':
        return [
          this.btn('Ctrl+C', () => this.actions.sendCtrlC(), scope, {
            color: '#ff4444',
            fontWeight: 'bold'
          }),
          this.btn('🔍', () => this.actions.toggleSearch(), scope),
          this.btn('≡', () => this.actions.expandToolbar(), scope)
        ];
      case 'claude':
        return [
          this.btn('Claude', () => this.actions.goToAgents(), scope, {
            color: '#6eb0ff',
            fontWeight: 'bold'
          }),
          this.btn('🔍', () => this.actions.toggleSearch(), scope),
          this.btn('≡', () => this.actions.expandToolbar(), scope)
        ];
      case 'selecting':
        return [
          this.btn('📋', () => this.actions.copySelection(), scope),
          this.btn('≡', () => this.actions.expandToolbar(), scope)
        ];
    }
  }

  private btn(
    label: string,
    onClick: () => void,
    scope: Scope,
    style?: Partial<CSSStyleDeclaration>
  ): HTMLElement {
    const el = document.createElement('button');
    el.textContent = label;
    el.style.cssText = `
      background: rgba(255,255,255,0.1); border: none; color: #e0e0e0;
      padding: 6px 12px; border-radius: 14px; font-size: 13px;
      cursor: pointer; white-space: nowrap;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    `;
    if (style) Object.assign(el.style, style);
    scope.on(
      el,
      'touchstart',
      (e) => {
        e.preventDefault();
        onClick();
      },
      { passive: false }
    );
    scope.on(el, 'click', onClick);
    return el;
  }
}
