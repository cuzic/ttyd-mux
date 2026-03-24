import { beforeEach, describe, expect, it } from 'bun:test';
import { toolbarEvents } from '@/browser/shared/events.js';
import { Scope } from '@/browser/shared/lifecycle.js';
import { TerminalStateTracker } from './TerminalStateTracker.js';

describe('TerminalStateTracker', () => {
  let tracker: TerminalStateTracker;
  let scope: Scope;

  beforeEach(() => {
    tracker = new TerminalStateTracker();
    scope = new Scope();
    tracker.mount(scope);
  });

  it('starts in idle state', () => {
    expect(tracker.state).toBe('idle');
  });

  it('transitions to busy on block:start', () => {
    toolbarEvents.emit('block:start');
    expect(tracker.state).toBe('busy');
  });

  it('transitions back to idle on block:end', () => {
    toolbarEvents.emit('block:start');
    toolbarEvents.emit('block:end');
    expect(tracker.state).toBe('idle');
  });

  it('transitions to claude on claude:toolUse', () => {
    toolbarEvents.emit('claude:toolUse');
    expect(tracker.state).toBe('claude');
  });

  it('transitions back to idle on claude:sessionEnd', () => {
    toolbarEvents.emit('claude:toolUse');
    toolbarEvents.emit('claude:sessionEnd');
    expect(tracker.state).toBe('idle');
  });

  it('transitions to selecting on selection:change true when idle', () => {
    toolbarEvents.emit('selection:change', true);
    expect(tracker.state).toBe('selecting');
  });

  it('transitions back to idle on selection:change false when selecting', () => {
    toolbarEvents.emit('selection:change', true);
    toolbarEvents.emit('selection:change', false);
    expect(tracker.state).toBe('idle');
  });

  it('does not transition to selecting when busy', () => {
    toolbarEvents.emit('block:start');
    toolbarEvents.emit('selection:change', true);
    expect(tracker.state).toBe('busy');
  });

  it('calls onChange callbacks on state change', () => {
    const states: string[] = [];
    tracker.onChange((state) => states.push(state));

    toolbarEvents.emit('block:start');
    toolbarEvents.emit('block:end');

    expect(states).toEqual(['busy', 'idle']);
  });

  it('does not call onChange for duplicate state', () => {
    const states: string[] = [];
    tracker.onChange((state) => states.push(state));

    toolbarEvents.emit('block:start');
    toolbarEvents.emit('block:start'); // duplicate

    expect(states).toEqual(['busy']);
  });

  it('unsubscribes onChange callback', () => {
    const states: string[] = [];
    const unsubscribe = tracker.onChange((state) => states.push(state));

    toolbarEvents.emit('block:start');
    unsubscribe();
    toolbarEvents.emit('block:end');

    expect(states).toEqual(['busy']);
  });

  it('cleans up event listeners when scope closes', () => {
    const states: string[] = [];
    tracker.onChange((state) => states.push(state));

    scope.close();

    toolbarEvents.emit('block:start');
    expect(states).toEqual([]);
    expect(tracker.state).toBe('idle');
  });
});
