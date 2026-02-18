import { describe, expect, test } from 'bun:test';
import { imeHelperScript, injectImeHelper } from './ime-helper.js';

// Top-level regex patterns for linter compliance
const SAVE_FONT_SIZE_TRY_CATCH = /saveFontSize[\s\S]*?try\s*\{[\s\S]*?catch\s*\(e\)/;
const LOAD_FONT_SIZE_TRY_CATCH = /loadFontSize[\s\S]*?try\s*\{[\s\S]*?catch\s*\(e\)/;
const APPLY_STORED_FONT_SIZE_FIT = /applyStoredFontSize[\s\S]*?fitTerminal\(\)/;
const ZOOM_TERMINAL_SAVE = /zoomTerminal[\s\S]*?saveFontSize\(newSize\)/;

describe('ime-helper', () => {
  describe('imeHelperScript', () => {
    test('contains style tag', () => {
      expect(imeHelperScript).toContain('<style>');
      expect(imeHelperScript).toContain('</style>');
    });

    test('contains script tag', () => {
      expect(imeHelperScript).toContain('<script>');
      expect(imeHelperScript).toContain('</script>');
    });

    test('contains IME container element', () => {
      expect(imeHelperScript).toContain('ttyd-ime-container');
    });

    test('contains IME toggle button', () => {
      expect(imeHelperScript).toContain('ttyd-ime-toggle');
    });
  });

  describe('font size configuration', () => {
    test('defines FONT_SIZE_MIN as 10', () => {
      expect(imeHelperScript).toContain('const FONT_SIZE_MIN = 10');
    });

    test('defines FONT_SIZE_MAX as 48', () => {
      expect(imeHelperScript).toContain('const FONT_SIZE_MAX = 48');
    });

    test('defines mobile default font size as 32', () => {
      expect(imeHelperScript).toContain('isMobile ? 32 : 14');
    });

    test('defines localStorage key for font size', () => {
      expect(imeHelperScript).toContain("const FONT_SIZE_STORAGE_KEY = 'ttyd-ime-font-size'");
    });
  });

  describe('saveFontSize function', () => {
    test('is defined in the script', () => {
      expect(imeHelperScript).toContain('function saveFontSize(size)');
    });

    test('uses localStorage.setItem', () => {
      expect(imeHelperScript).toContain(
        'localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(size))'
      );
    });

    test('handles errors gracefully', () => {
      expect(imeHelperScript).toMatch(SAVE_FONT_SIZE_TRY_CATCH);
    });
  });

  describe('loadFontSize function', () => {
    test('is defined in the script', () => {
      expect(imeHelperScript).toContain('function loadFontSize()');
    });

    test('uses localStorage.getItem', () => {
      expect(imeHelperScript).toContain('localStorage.getItem(FONT_SIZE_STORAGE_KEY)');
    });

    test('validates size is within range', () => {
      expect(imeHelperScript).toContain('size >= FONT_SIZE_MIN && size <= FONT_SIZE_MAX');
    });

    test('returns default on invalid value', () => {
      expect(imeHelperScript).toContain('return FONT_SIZE_DEFAULT');
    });

    test('handles errors gracefully', () => {
      expect(imeHelperScript).toMatch(LOAD_FONT_SIZE_TRY_CATCH);
    });
  });

  describe('applyStoredFontSize function', () => {
    test('is defined in the script', () => {
      expect(imeHelperScript).toContain('function applyStoredFontSize()');
    });

    test('calls loadFontSize to get stored value', () => {
      expect(imeHelperScript).toContain('const storedSize = loadFontSize()');
    });

    test('applies font size to terminal', () => {
      expect(imeHelperScript).toContain('term.options.fontSize = storedSize');
    });

    test('calls fitTerminal after applying', () => {
      expect(imeHelperScript).toMatch(APPLY_STORED_FONT_SIZE_FIT);
    });
  });

  describe('zoomTerminal function', () => {
    test('uses FONT_SIZE_MIN and FONT_SIZE_MAX for clamping', () => {
      expect(imeHelperScript).toContain(
        'Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, currentSize + delta))'
      );
    });

    test('saves font size after zoom', () => {
      expect(imeHelperScript).toMatch(ZOOM_TERMINAL_SAVE);
    });
  });

  describe('pinch zoom', () => {
    test('uses FONT_SIZE_MIN and FONT_SIZE_MAX for clamping', () => {
      expect(imeHelperScript).toContain(
        'Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, newSize))'
      );
    });

    test('saves font size after pinch zoom', () => {
      expect(imeHelperScript).toContain('saveFontSize(clampedSize)');
    });
  });

  describe('font size restoration on load', () => {
    test('calls applyStoredFontSize on timeout', () => {
      expect(imeHelperScript).toContain('setTimeout(applyStoredFontSize, 500)');
      expect(imeHelperScript).toContain('setTimeout(applyStoredFontSize, 1500)');
    });
  });

  describe('injectImeHelper', () => {
    test('injects script before </body>', () => {
      const html = '<html><head></head><body><p>content</p></body></html>';
      const result = injectImeHelper(html);

      expect(result).toContain(imeHelperScript);
      expect(result).toContain('</body>');
      expect(result.indexOf(imeHelperScript)).toBeLessThan(result.indexOf('</body>'));
    });

    test('preserves original HTML content', () => {
      const html = '<html><head><title>Test</title></head><body><p>Hello World</p></body></html>';
      const result = injectImeHelper(html);

      expect(result).toContain('<title>Test</title>');
      expect(result).toContain('<p>Hello World</p>');
    });

    test('handles HTML without body closing tag', () => {
      const html = '<html><head></head><body><p>content</p>';
      const result = injectImeHelper(html);

      // Should not modify since there's no </body> to replace
      expect(result).toBe(html);
    });

    test('only replaces first </body> tag', () => {
      const html = '<html><body>content</body></html>';
      const result = injectImeHelper(html);

      // Count occurrences of </body>
      const bodyCloseCount = (result.match(/<\/body>/g) || []).length;
      expect(bodyCloseCount).toBe(1);
    });
  });
});
