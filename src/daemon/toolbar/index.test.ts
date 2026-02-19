import { describe, expect, test } from 'bun:test';
import {
  AUTO_RUN_KEY,
  DEFAULT_TOOLBAR_CONFIG,
  ONBOARDING_SHOWN_KEY,
  STORAGE_KEY,
  injectToolbar,
  onboardingHtml,
  toolbarHtml,
  toolbarStyles
} from './index.js';

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

describe('injectToolbar', () => {
  test('injects styles, HTML, config, and script tag before </body>', () => {
    const html = '<html><head></head><body><p>content</p></body></html>';
    const result = injectToolbar(html, '/ttyd-mux');

    expect(result).toContain('<style>');
    expect(result).toContain('#ttyd-toolbar');
    expect(result).toContain('window.__TOOLBAR_CONFIG__');
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

  test('embeds default config as JSON when no config provided', () => {
    const html = '<html><body></body></html>';
    const result = injectToolbar(html, '/ttyd-mux');

    expect(result).toContain(`"font_size_min":${DEFAULT_TOOLBAR_CONFIG.font_size_min}`);
    expect(result).toContain(`"font_size_max":${DEFAULT_TOOLBAR_CONFIG.font_size_max}`);
    expect(result).toContain(`"double_tap_delay":${DEFAULT_TOOLBAR_CONFIG.double_tap_delay}`);
  });

  test('embeds custom config as JSON', () => {
    const html = '<html><body></body></html>';
    const customConfig = {
      font_size_min: 12,
      font_size_max: 64,
      font_size_default_mobile: 28,
      font_size_default_pc: 16,
      double_tap_delay: 400
    };
    const result = injectToolbar(html, '/ttyd-mux', customConfig);

    expect(result).toContain('"font_size_min":12');
    expect(result).toContain('"font_size_max":64');
    expect(result).toContain('"font_size_default_mobile":28');
    expect(result).toContain('"font_size_default_pc":16');
    expect(result).toContain('"double_tap_delay":400');
  });

  test('config script appears before toolbar.js script', () => {
    const html = '<html><body></body></html>';
    const result = injectToolbar(html, '/ttyd-mux');

    const configIndex = result.indexOf('__TOOLBAR_CONFIG__');
    const toolbarJsIndex = result.indexOf('toolbar.js');
    expect(configIndex).toBeLessThan(toolbarJsIndex);
  });
});

// =============================================================================
// Search functionality tests (Issue #3)
// =============================================================================

describe('toolbar/search - template', () => {
  test('contains search button in toolbar', () => {
    expect(toolbarHtml).toContain('id="ttyd-toolbar-search"');
  });

  test('contains search bar container', () => {
    expect(toolbarHtml).toContain('id="ttyd-search-bar"');
  });

  test('contains search input field', () => {
    expect(toolbarHtml).toContain('id="ttyd-search-input"');
  });

  test('contains search navigation buttons', () => {
    expect(toolbarHtml).toContain('id="ttyd-search-prev"');
    expect(toolbarHtml).toContain('id="ttyd-search-next"');
  });

  test('contains search close button', () => {
    expect(toolbarHtml).toContain('id="ttyd-search-close"');
  });

  test('contains match count display', () => {
    expect(toolbarHtml).toContain('id="ttyd-search-count"');
  });

  test('contains case sensitivity toggle', () => {
    expect(toolbarHtml).toContain('id="ttyd-search-case"');
  });

  test('contains regex toggle', () => {
    expect(toolbarHtml).toContain('id="ttyd-search-regex"');
  });
});

describe('toolbar/search - styles', () => {
  test('contains search bar styles', () => {
    expect(toolbarStyles).toContain('#ttyd-search-bar');
  });

  test('contains search input styles', () => {
    expect(toolbarStyles).toContain('#ttyd-search-input');
  });

  test('contains search bar hidden state', () => {
    expect(toolbarStyles).toContain('#ttyd-search-bar.hidden');
  });
});
