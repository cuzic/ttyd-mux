import { describe, expect, test } from 'bun:test';
import {
  AUTO_RUN_KEY,
  DEFAULT_TOOLBAR_CONFIG,
  ONBOARDING_SHOWN_KEY,
  STORAGE_KEY,
  getToolbarJs,
  getToolbarScript,
  injectToolbar,
  onboardingHtml,
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
  test('DEFAULT_TOOLBAR_CONFIG has correct font_size_min', () => {
    expect(DEFAULT_TOOLBAR_CONFIG.font_size_min).toBe(10);
  });

  test('DEFAULT_TOOLBAR_CONFIG has correct font_size_max', () => {
    expect(DEFAULT_TOOLBAR_CONFIG.font_size_max).toBe(48);
  });

  test('DEFAULT_TOOLBAR_CONFIG has correct font_size_default_mobile', () => {
    expect(DEFAULT_TOOLBAR_CONFIG.font_size_default_mobile).toBe(32);
  });

  test('DEFAULT_TOOLBAR_CONFIG has correct font_size_default_pc', () => {
    expect(DEFAULT_TOOLBAR_CONFIG.font_size_default_pc).toBe(14);
  });

  test('DEFAULT_TOOLBAR_CONFIG has correct double_tap_delay', () => {
    expect(DEFAULT_TOOLBAR_CONFIG.double_tap_delay).toBe(300);
  });

  test('STORAGE_KEY is defined', () => {
    expect(STORAGE_KEY).toBe('ttyd-toolbar-font-size');
  });

  test('ONBOARDING_SHOWN_KEY is defined', () => {
    expect(ONBOARDING_SHOWN_KEY).toBe('ttyd-toolbar-onboarding-shown');
  });

  test('AUTO_RUN_KEY is defined', () => {
    expect(AUTO_RUN_KEY).toBe('ttyd-toolbar-auto-run');
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

  test('contains minimized mode styles', () => {
    expect(toolbarStyles).toContain('#ttyd-toolbar.minimized');
    expect(toolbarStyles).toContain('#ttyd-toolbar.minimized #ttyd-toolbar-buttons');
  });

  test('contains minimize button styles', () => {
    expect(toolbarStyles).toContain('#ttyd-toolbar-minimize');
  });

  test('contains onboarding tooltip styles', () => {
    expect(toolbarStyles).toContain('#ttyd-toolbar-onboarding');
    expect(toolbarStyles).toContain('#ttyd-toolbar-onboarding-close');
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

  test('contains minimize button', () => {
    expect(toolbarHtml).toContain('id="ttyd-toolbar-minimize"');
  });
});

describe('toolbar/onboarding', () => {
  test('contains onboarding container', () => {
    expect(onboardingHtml).toContain('id="ttyd-toolbar-onboarding"');
  });

  test('contains close button', () => {
    expect(onboardingHtml).toContain('id="ttyd-toolbar-onboarding-close"');
  });

  test('contains tips content', () => {
    expect(onboardingHtml).toContain('Ctrl+J');
    expect(onboardingHtml).toContain('ピンチ操作');
    expect(onboardingHtml).toContain('ダブルタップ');
  });
});

describe('toolbar/script', () => {
  const script = getToolbarScript();

  test('is wrapped in IIFE', () => {
    expect(script).toMatch(IIFE_START);
    expect(script).toMatch(IIFE_END);
  });

  test('contains font size configuration', () => {
    expect(script).toContain(`const FONT_SIZE_MIN = ${DEFAULT_TOOLBAR_CONFIG.font_size_min}`);
    expect(script).toContain(`const FONT_SIZE_MAX = ${DEFAULT_TOOLBAR_CONFIG.font_size_max}`);
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
    expect(script).toContain(`const DOUBLE_TAP_DELAY = ${DEFAULT_TOOLBAR_CONFIG.double_tap_delay}`);
  });

  test('contains minimize button reference', () => {
    expect(script).toContain('const minimizeBtn');
  });

  test('contains minimize event handler', () => {
    expect(script).toContain("minimizeBtn.addEventListener('click'");
    expect(script).toContain("container.classList.toggle('minimized')");
  });

  test('contains onboarding key constant', () => {
    expect(script).toContain(`const ONBOARDING_KEY = '${ONBOARDING_SHOWN_KEY}'`);
  });

  test('contains showOnboarding function', () => {
    expect(script).toContain('function showOnboarding()');
  });

  test('onboarding saves to localStorage', () => {
    expect(script).toContain("localStorage.setItem(ONBOARDING_KEY, '1')");
  });

  test('onboarding checks localStorage', () => {
    expect(script).toContain('localStorage.getItem(ONBOARDING_KEY)');
  });

  test('onboarding auto-dismisses after timeout', () => {
    expect(script).toContain('setTimeout(function()');
    expect(script).toContain('15000');
  });

  // Scroll mode tests
  test('contains scroll button reference', () => {
    expect(script).toContain('const scrollBtn');
    expect(script).toContain('const pageUpBtn');
    expect(script).toContain('const pageDownBtn');
  });

  test('contains scrollActive state variable', () => {
    expect(script).toContain('let scrollActive = false');
  });

  test('contains sendPageUp function', () => {
    expect(script).toContain('function sendPageUp()');
    expect(script).toContain('[0x1B, 0x5B, 0x35, 0x7E]'); // ESC [ 5 ~
  });

  test('contains sendPageDown function', () => {
    expect(script).toContain('function sendPageDown()');
    expect(script).toContain('[0x1B, 0x5B, 0x36, 0x7E]'); // ESC [ 6 ~
  });

  test('contains scroll button event handler', () => {
    expect(script).toContain("scrollBtn.addEventListener('click'");
    expect(script).toContain('scrollActive = !scrollActive');
    expect(script).toContain("scrollBtn.classList.toggle('active', scrollActive)");
  });

  test('contains pageUp button event handler', () => {
    expect(script).toContain("pageUpBtn.addEventListener('click'");
    expect(script).toContain('sendPageUp()');
  });

  test('contains pageDown button event handler', () => {
    expect(script).toContain("pageDownBtn.addEventListener('click'");
    expect(script).toContain('sendPageDown()');
  });

  test('contains scroll touch mode variables', () => {
    expect(script).toContain('let scrollTouchActive = false');
    expect(script).toContain('let scrollLastY = 0');
    expect(script).toContain('const SCROLL_THRESHOLD = 30');
  });

  test('contains scroll touch handling in touchstart', () => {
    expect(script).toContain('if (e.touches.length === 1 && scrollActive)');
  });

  test('contains scroll drag handling in touchmove', () => {
    expect(script).toContain('if (e.touches.length === 1 && scrollTouchActive)');
    expect(script).toContain('const deltaY = scrollLastY - touch.clientY');
    expect(script).toContain('if (Math.abs(deltaY) >= SCROLL_THRESHOLD)');
  });

  // Auto-run persistence tests
  test('contains AUTO_RUN_STORAGE_KEY constant', () => {
    expect(script).toContain(`const AUTO_RUN_STORAGE_KEY = '${AUTO_RUN_KEY}'`);
  });

  test('contains saveAutoRun function', () => {
    expect(script).toContain('function saveAutoRun(enabled)');
    expect(script).toContain("localStorage.setItem(AUTO_RUN_STORAGE_KEY, enabled ? '1' : '0')");
  });

  test('contains loadAutoRun function', () => {
    expect(script).toContain('function loadAutoRun()');
    expect(script).toContain('localStorage.getItem(AUTO_RUN_STORAGE_KEY)');
    expect(script).toContain("return saved === '1'");
  });

  test('auto button click handler saves state', () => {
    expect(script).toContain('saveAutoRun(autoRunActive)');
  });

  test('contains applyStoredAutoRun function', () => {
    expect(script).toContain('function applyStoredAutoRun()');
    expect(script).toContain('const storedAutoRun = loadAutoRun()');
  });

  test('applyStoredAutoRun is called on init', () => {
    expect(script).toContain('applyStoredAutoRun();');
  });
});

describe('getToolbarJs', () => {
  test('returns the toolbar script with default config', () => {
    const js = getToolbarJs();
    expect(js).toBe(getToolbarScript());
  });

  test('accepts custom config', () => {
    const customConfig = {
      font_size_min: 12,
      font_size_max: 64,
      font_size_default_mobile: 28,
      font_size_default_pc: 16,
      double_tap_delay: 400
    };
    const js = getToolbarJs(customConfig);

    expect(js).toContain('const FONT_SIZE_MIN = 12');
    expect(js).toContain('const FONT_SIZE_MAX = 64');
    expect(js).toContain('isMobile ? 28 : 16');
    expect(js).toContain('const DOUBLE_TAP_DELAY = 400');
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

  test('includes onboarding HTML', () => {
    const html = '<html><body></body></html>';
    const result = injectToolbar(html, '/ttyd-mux');

    expect(result).toContain('id="ttyd-toolbar-onboarding"');
  });

  test('onboarding HTML is hidden by default', () => {
    const html = '<html><body></body></html>';
    const result = injectToolbar(html, '/ttyd-mux');

    expect(result).toContain('style="display:none"');
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
