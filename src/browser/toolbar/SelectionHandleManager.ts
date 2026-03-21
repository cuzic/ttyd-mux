/**
 * Selection Handle Manager
 *
 * Manages selection handles for mobile text selection.
 * Shows draggable handles at the start and end of selection
 * to allow fine-tuning of selected text.
 */

import { toolbarEvents } from '@/browser/shared/events.js';
import { type Mountable, type Scope, on } from '@/browser/shared/lifecycle.js';
import type { Terminal } from '@/browser/shared/types.js';

interface SelectionPosition {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export class SelectionHandleManager implements Mountable {
  private terminal: Terminal | null = null;
  private container: HTMLElement | null = null;
  private startHandle: HTMLElement | null = null;
  private endHandle: HTMLElement | null = null;
  private copyBtn: HTMLElement | null = null;

  private selection: SelectionPosition | null = null;
  private activeHandle: 'start' | 'end' | null = null;
  private handleOffset = { x: 0, y: 0 };

  /**
   * Bind DOM elements
   */
  bindElements(
    container: HTMLElement,
    startHandle: HTMLElement,
    endHandle: HTMLElement,
    copyBtn: HTMLElement
  ): void {
    this.container = container;
    this.startHandle = startHandle;
    this.endHandle = endHandle;
    this.copyBtn = copyBtn;
  }

  /**
   * Set terminal reference
   */
  setTerminal(terminal: Terminal): void {
    this.terminal = terminal;
  }

  /**
   * Mount event handlers
   */
  mount(scope: Scope): void {
    // Start handle touch events
    if (this.startHandle) {
      scope.add(
        on(this.startHandle, 'touchstart', (e) => this.onHandleTouchStart(e as TouchEvent, 'start'), {
          passive: false
        })
      );
    }

    // End handle touch events
    if (this.endHandle) {
      scope.add(
        on(this.endHandle, 'touchstart', (e) => this.onHandleTouchStart(e as TouchEvent, 'end'), {
          passive: false
        })
      );
    }

    // Document-level touch events for handle dragging
    scope.add(
      on(document, 'touchmove', (e) => this.onHandleTouchMove(e as TouchEvent), { passive: false })
    );
    scope.add(on(document, 'touchend', (e) => this.onHandleTouchEnd(e as TouchEvent)));

    // Copy button
    if (this.copyBtn) {
      scope.add(
        on(this.copyBtn, 'click', () => {
          this.copySelection();
        })
      );
    }

    // Hide handles when clicking outside terminal
    scope.add(
      on(document, 'touchstart', (e) => {
        const target = e.target as HTMLElement;
        // Don't hide if touching handles, copy button, or terminal
        if (
          this.container?.classList.contains('hidden') ||
          target.closest('#tui-selection-handles') ||
          target.closest('#tui-selection-copy-btn') ||
          target.closest('.xterm')
        ) {
          return;
        }
        this.hide();
      })
    );

    // Listen for Escape key to hide
    scope.add(
      on(document, 'keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Escape' && !this.container?.classList.contains('hidden')) {
          this.hide();
        }
      })
    );
  }

  /**
   * Show handles for current terminal selection
   */
  show(): void {
    if (!this.terminal || !this.container) {
      return;
    }

    // Get selection from terminal
    const selectionRange = this.getSelectionRange();
    if (!selectionRange) {
      this.hide();
      return;
    }

    this.selection = selectionRange;
    this.container.classList.remove('hidden');
    this.copyBtn?.classList.remove('hidden');
    this.updateHandlePositions();
  }

  /**
   * Hide handles and copy button
   */
  hide(): void {
    this.container?.classList.add('hidden');
    this.copyBtn?.classList.add('hidden');
    this.selection = null;
    this.terminal?.clearSelection();
  }

  /**
   * Check if handles are visible
   */
  isVisible(): boolean {
    return !this.container?.classList.contains('hidden');
  }

  /**
   * Get current selection range from terminal
   */
  private getSelectionRange(): SelectionPosition | null {
    if (!this.terminal?.getSelectionPosition) {
      return null;
    }

    const pos = this.terminal.getSelectionPosition();
    if (!pos) {
      return null;
    }

    return {
      startRow: pos.start.y,
      startCol: pos.start.x,
      endRow: pos.end.y,
      endCol: pos.end.x
    };
  }

  /**
   * Update handle positions based on selection
   */
  private updateHandlePositions(): void {
    if (!this.selection || !this.terminal || !this.startHandle || !this.endHandle) {
      return;
    }

    const termEl = this.terminal.element;
    if (!termEl) {
      return;
    }

    const cellDims = this.getCellDimensions();
    if (!cellDims) {
      return;
    }

    const termRect = termEl.getBoundingClientRect();
    const scrollOffset = this.terminal.buffer?.active?.viewportY ?? 0;

    // Calculate start handle position (left side of first character)
    const startX = termRect.left + this.selection.startCol * cellDims.width;
    const startY =
      termRect.top + (this.selection.startRow - scrollOffset + 1) * cellDims.height;

    // Calculate end handle position (right side of last character)
    const endX = termRect.left + this.selection.endCol * cellDims.width;
    const endY = termRect.top + (this.selection.endRow - scrollOffset + 1) * cellDims.height;

    // Position handles
    this.startHandle.style.left = `${startX - 12}px`; // Center handle on position
    this.startHandle.style.top = `${startY}px`;
    this.endHandle.style.left = `${endX - 12}px`;
    this.endHandle.style.top = `${endY}px`;

    // Position copy button above the end handle
    if (this.copyBtn) {
      const copyBtnX = Math.max(60, Math.min(endX, window.innerWidth - 60));
      const copyBtnY = Math.max(40, endY - 40);
      this.copyBtn.style.left = `${copyBtnX}px`;
      this.copyBtn.style.top = `${copyBtnY}px`;
    }
  }

  /**
   * Get cell dimensions from terminal
   */
  private getCellDimensions(): { width: number; height: number } | null {
    if (!this.terminal) {
      return null;
    }

    // Try to get dimensions from terminal
    const term = this.terminal as Terminal & {
      _core?: {
        _renderService?: {
          dimensions?: {
            css?: { cell: { width: number; height: number } };
          };
        };
      };
    };

    const dims = term._core?._renderService?.dimensions?.css?.cell;
    if (dims) {
      return dims;
    }

    // Fallback: estimate from font size
    const fontSize = this.terminal.options?.fontSize ?? 14;
    return {
      width: fontSize * 0.6,
      height: fontSize * 1.2
    };
  }

  /**
   * Handle touch start on a handle
   */
  private onHandleTouchStart(e: TouchEvent, handle: 'start' | 'end'): void {
    e.preventDefault();
    e.stopPropagation();

    this.activeHandle = handle;
    const touch = e.touches[0];
    const handleEl = handle === 'start' ? this.startHandle : this.endHandle;

    if (handleEl) {
      const rect = handleEl.getBoundingClientRect();
      this.handleOffset = {
        x: touch.clientX - rect.left - rect.width / 2,
        y: touch.clientY - rect.top - rect.height / 2
      };
    }
  }

  /**
   * Handle touch move for dragging
   */
  private onHandleTouchMove(e: TouchEvent): void {
    if (!this.activeHandle || !this.terminal || !this.selection) {
      return;
    }

    e.preventDefault();
    const touch = e.touches[0];
    const pos = this.screenToCell(touch.clientX - this.handleOffset.x, touch.clientY - this.handleOffset.y);

    if (!pos) {
      return;
    }

    // Update selection based on which handle is being dragged
    if (this.activeHandle === 'start') {
      // Ensure start doesn't go past end
      if (
        pos.row < this.selection.endRow ||
        (pos.row === this.selection.endRow && pos.col < this.selection.endCol)
      ) {
        this.selection.startRow = pos.row;
        this.selection.startCol = pos.col;
      }
    } else {
      // Ensure end doesn't go before start
      if (
        pos.row > this.selection.startRow ||
        (pos.row === this.selection.startRow && pos.col > this.selection.startCol)
      ) {
        this.selection.endRow = pos.row;
        this.selection.endCol = pos.col;
      }
    }

    // Update terminal selection
    this.applySelection();
    this.updateHandlePositions();
  }

  /**
   * Handle touch end
   */
  private onHandleTouchEnd(_e: TouchEvent): void {
    this.activeHandle = null;
  }

  /**
   * Convert screen coordinates to terminal cell position
   */
  private screenToCell(x: number, y: number): { row: number; col: number } | null {
    if (!this.terminal) {
      return null;
    }

    const termEl = this.terminal.element;
    if (!termEl) {
      return null;
    }

    const cellDims = this.getCellDimensions();
    if (!cellDims) {
      return null;
    }

    const termRect = termEl.getBoundingClientRect();
    const scrollOffset = this.terminal.buffer?.active?.viewportY ?? 0;

    const col = Math.round((x - termRect.left) / cellDims.width);
    const row = Math.floor((y - termRect.top) / cellDims.height) + scrollOffset;

    // Clamp to valid range
    const cols = this.terminal.cols ?? 80;
    const rows = (this.terminal.buffer?.active?.length ?? 24) - 1;

    return {
      col: Math.max(0, Math.min(cols, col)),
      row: Math.max(0, Math.min(rows, row))
    };
  }

  /**
   * Apply current selection to terminal
   */
  private applySelection(): void {
    if (!this.terminal || !this.selection) {
      return;
    }

    // xterm.js select() method: select(column, row, length)
    // For multi-line selection, we need to use selectLines or calculate length
    const term = this.terminal as Terminal & {
      selectLines?: (start: number, end: number) => void;
      select?: (column: number, row: number, length: number) => void;
    };

    if (this.selection.startRow === this.selection.endRow) {
      // Single line selection
      const length = this.selection.endCol - this.selection.startCol;
      if (term.select && length > 0) {
        term.select(this.selection.startCol, this.selection.startRow, length);
      }
    } else if (term.selectLines) {
      // Multi-line selection
      term.selectLines(this.selection.startRow, this.selection.endRow);
    }
  }

  /**
   * Copy selection to clipboard
   */
  private async copySelection(): Promise<void> {
    if (!this.terminal) {
      return;
    }

    const selection = this.terminal.getSelection();
    if (!selection) {
      return;
    }

    try {
      await navigator.clipboard.writeText(selection);
      toolbarEvents.emit('toast:show', { message: 'Copied!', type: 'success' });
    } catch (err) {
      toolbarEvents.emit('toast:show', { message: 'Copy failed', type: 'error' });
    }

    this.hide();
  }
}
