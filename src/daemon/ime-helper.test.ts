import { describe, expect, test } from 'bun:test';
import { imeHelperScript, injectImeHelper } from './ime-helper.js';

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
