import { describe, expect, test } from 'bun:test';
import {
  DOUBLE_TAP_DELAY,
  FONT_SIZE_DEFAULT_MOBILE,
  FONT_SIZE_DEFAULT_PC,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  STORAGE_KEY,
  getToolbarJs,
  getToolbarScript,
  injectToolbar,
  toolbarHtml,
  toolbarStyles
} from './index.js';

// Top-level regex patterns for linter compliance
const IIFE_START = /^\(function\(\)/;
const IIFE_END = /\}\)\(\);$/;
const SAVE_FONT_SIZE_TRY_CATCH = /saveFontSize[\s\S]*?try\s*\{[\s\S]*?catch\s*\(e\)/;
const LOAD_FONT_SIZE_TRY_CATCH = /loadFontSize[\s\S]*?try\s*\{[\s\S]*?catch\s*\(e\)/;
const APPLY_STORED_FONT_SIZE_FIT = /applyStoredFontSize[\s\S]*?fitTerminal\(\)/;
const ZOOM_TERMINAL_SAVE = /zoomTerminal[\s\S]*?saveFontSize\(newSize\)/;

describe('toolbar/config', () => {
  test('FONT_SIZE_MIN is 10', () => {
    expect(FONT_SIZE_MIN).toBe(10);
  });

  test('FONT_SIZE_MAX is 48', () => {
    expect(FONT_SIZE_MAX).toBe(48);
  });

  test('FONT_SIZE_DEFAULT_MOBILE is 32', () => {
    expect(FONT_SIZE_DEFAULT_MOBILE).toBe(32);
  });

  test('FONT_SIZE_DEFAULT_PC is 14', () => {
    expect(FONT_SIZE_DEFAULT_PC).toBe(14);
  });

  test('STORAGE_KEY is defined', () => {
    expect(STORAGE_KEY).toBe('ttyd-toolbar-font-size');
  });

  test('DOUBLE_TAP_DELAY is 300', () => {
    expect(DOUBLE_TAP_DELAY).toBe(300);
  });
});

describe('toolbar/styles', () => {
  test('contains toolbar container styles', () => {
    expect(toolbarStyles).toContain('#ttyd-toolbar');
  });

  test('contains toolbar toggle button styles', () => {
    expect(toolbarStyles).toContain('#ttyd-toolbar-toggle');
  });

  test('contains button styles', () => {
    expect(toolbarStyles).toContain('#ttyd-toolbar-buttons button');
  });

  test('contains mobile media query', () => {
    expect(toolbarStyles).toContain('@media (max-width: 768px)');
  });

  test('contains hidden class', () => {
    expect(toolbarStyles).toContain('#ttyd-toolbar.hidden');
  });
});

describe('toolbar/template', () => {
  test('contains toolbar container element', () => {
    expect(toolbarHtml).toContain('id="ttyd-toolbar"');
  });

  test('contains toolbar toggle button', () => {
    expect(toolbarHtml).toContain('id="ttyd-toolbar-toggle"');
  });

  test('contains modifier buttons', () => {
    expect(toolbarHtml).toContain('id="ttyd-toolbar-ctrl"');
    expect(toolbarHtml).toContain('id="ttyd-toolbar-alt"');
    expect(toolbarHtml).toContain('id="ttyd-toolbar-shift"');
  });

  test('contains zoom buttons', () => {
    expect(toolbarHtml).toContain('id="ttyd-toolbar-zoomin"');
    expect(toolbarHtml).toContain('id="ttyd-toolbar-zoomout"');
  });

  test('contains copy buttons', () => {
    expect(toolbarHtml).toContain('id="ttyd-toolbar-copy"');
    expect(toolbarHtml).toContain('id="ttyd-toolbar-copyall"');
  });

  test('contains input textarea', () => {
    expect(toolbarHtml).toContain('id="ttyd-toolbar-input"');
  });

  test('has hidden class by default', () => {
    expect(toolbarHtml).toContain('class="hidden"');
  });
});

describe('toolbar/script', () => {
  const script = getToolbarScript();

  test('is wrapped in IIFE', () => {
    expect(script).toMatch(IIFE_START);
    expect(script).toMatch(IIFE_END);
  });

  test('contains font size configuration', () => {
    expect(script).toContain(`const FONT_SIZE_MIN = ${FONT_SIZE_MIN}`);
    expect(script).toContain(`const FONT_SIZE_MAX = ${FONT_SIZE_MAX}`);
  });

  test('contains mobile detection', () => {
    expect(script).toContain('const isMobile =');
  });

  test('contains saveFontSize function', () => {
    expect(script).toContain('function saveFontSize(size)');
  });

  test('contains loadFontSize function', () => {
    expect(script).toContain('function loadFontSize()');
  });

  test('contains WebSocket interception', () => {
    expect(script).toContain('const OriginalWebSocket = window.WebSocket');
  });

  test('contains sendText function', () => {
    expect(script).toContain('function sendText(text)');
  });

  test('contains zoomTerminal function', () => {
    expect(script).toContain('function zoomTerminal(delta)');
  });

  test('contains double tap detection', () => {
    expect(script).toContain(`const DOUBLE_TAP_DELAY = ${DOUBLE_TAP_DELAY}`);
  });
});

describe('getToolbarJs', () => {
  test('returns the toolbar script', () => {
    const js = getToolbarJs();
    expect(js).toBe(getToolbarScript());
  });
});

describe('injectToolbar', () => {
  test('injects styles, HTML, and script tag before </body>', () => {
    const html = '<html><head></head><body><p>content</p></body></html>';
    const result = injectToolbar(html, '/ttyd-mux');

    expect(result).toContain('<style>');
    expect(result).toContain('#ttyd-toolbar');
    expect(result).toContain('<script src="/ttyd-mux/toolbar.js"></script>');
    expect(result).toContain('</body>');
  });

  test('preserves original HTML content', () => {
    const html = '<html><head><title>Test</title></head><body><p>Hello World</p></body></html>';
    const result = injectToolbar(html, '/ttyd-mux');

    expect(result).toContain('<title>Test</title>');
    expect(result).toContain('<p>Hello World</p>');
  });

  test('handles HTML without body closing tag', () => {
    const html = '<html><head></head><body><p>content</p>';
    const result = injectToolbar(html, '/ttyd-mux');

    // Should not modify since there's no </body> to replace
    expect(result).toBe(html);
  });

  test('only replaces first </body> tag', () => {
    const html = '<html><body>content</body></html>';
    const result = injectToolbar(html, '/ttyd-mux');

    const bodyCloseCount = (result.match(/<\/body>/g) || []).length;
    expect(bodyCloseCount).toBe(1);
  });

  test('uses provided basePath in script src', () => {
    const html = '<html><body></body></html>';
    const result = injectToolbar(html, '/custom-path');

    expect(result).toContain('<script src="/custom-path/toolbar.js"></script>');
  });

  test('script tag appears before </body>', () => {
    const html = '<html><body></body></html>';
    const result = injectToolbar(html, '/ttyd-mux');

    const scriptIndex = result.indexOf('toolbar.js');
    const bodyIndex = result.indexOf('</body>');
    expect(scriptIndex).toBeLessThan(bodyIndex);
  });
});

// Tests for font size persistence logic (testing string content)
describe('font size persistence', () => {
  const script = getToolbarScript();

  test('saveFontSize uses localStorage.setItem', () => {
    expect(script).toContain('localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(size))');
  });

  test('saveFontSize handles errors gracefully', () => {
    expect(script).toMatch(SAVE_FONT_SIZE_TRY_CATCH);
  });

  test('loadFontSize uses localStorage.getItem', () => {
    expect(script).toContain('localStorage.getItem(FONT_SIZE_STORAGE_KEY)');
  });

  test('loadFontSize validates size range', () => {
    expect(script).toContain('size >= FONT_SIZE_MIN && size <= FONT_SIZE_MAX');
  });

  test('loadFontSize handles errors gracefully', () => {
    expect(script).toMatch(LOAD_FONT_SIZE_TRY_CATCH);
  });
});

describe('applyStoredFontSize', () => {
  const script = getToolbarScript();

  test('function is defined', () => {
    expect(script).toContain('function applyStoredFontSize()');
  });

  test('calls loadFontSize', () => {
    expect(script).toContain('const storedSize = loadFontSize()');
  });

  test('applies font size to terminal', () => {
    expect(script).toContain('term.options.fontSize = storedSize');
  });

  test('calls fitTerminal', () => {
    expect(script).toMatch(APPLY_STORED_FONT_SIZE_FIT);
  });

  test('is called on timeout', () => {
    expect(script).toContain('setTimeout(applyStoredFontSize, 500)');
    expect(script).toContain('setTimeout(applyStoredFontSize, 1500)');
  });
});

describe('zoom functionality', () => {
  const script = getToolbarScript();

  test('zoomTerminal clamps font size', () => {
    expect(script).toContain(
      'Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, currentSize + delta))'
    );
  });

  test('zoomTerminal saves font size', () => {
    expect(script).toMatch(ZOOM_TERMINAL_SAVE);
  });

  test('pinch zoom clamps font size', () => {
    expect(script).toContain('Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, newSize))');
  });

  test('pinch zoom saves font size', () => {
    expect(script).toContain('saveFontSize(clampedSize)');
  });
});
