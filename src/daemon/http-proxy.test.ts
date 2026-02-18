import { describe, expect, test } from 'bun:test';
import { gunzipSync } from 'node:zlib';
import {
  buildCleanHeaders,
  isHtmlContentType,
  supportsGzipEncoding,
  transformHtmlResponse
} from './http-proxy.js';

describe('buildCleanHeaders', () => {
  test('filters out undefined values', () => {
    const headers = {
      'content-type': 'text/html',
      'x-custom': undefined,
      'cache-control': 'no-cache'
    };
    const result = buildCleanHeaders(headers);
    expect(result).toEqual({
      'content-type': 'text/html',
      'cache-control': 'no-cache'
    });
    expect('x-custom' in result).toBe(false);
  });

  test('filters out content-encoding header', () => {
    const headers = {
      'content-type': 'text/html',
      'content-encoding': 'gzip'
    };
    const result = buildCleanHeaders(headers);
    expect(result).toEqual({
      'content-type': 'text/html'
    });
  });

  test('filters out transfer-encoding header', () => {
    const headers = {
      'content-type': 'text/html',
      'transfer-encoding': 'chunked'
    };
    const result = buildCleanHeaders(headers);
    expect(result).toEqual({
      'content-type': 'text/html'
    });
  });

  test('preserves array values', () => {
    const headers = {
      'set-cookie': ['a=1', 'b=2']
    };
    const result = buildCleanHeaders(headers);
    expect(result['set-cookie']).toEqual(['a=1', 'b=2']);
  });

  test('returns empty object for empty input', () => {
    const result = buildCleanHeaders({});
    expect(result).toEqual({});
  });
});

describe('isHtmlContentType', () => {
  test('returns true for text/html', () => {
    expect(isHtmlContentType('text/html')).toBe(true);
  });

  test('returns true for text/html with charset', () => {
    expect(isHtmlContentType('text/html; charset=utf-8')).toBe(true);
  });

  test('returns false for application/json', () => {
    expect(isHtmlContentType('application/json')).toBe(false);
  });

  test('returns false for text/plain', () => {
    expect(isHtmlContentType('text/plain')).toBe(false);
  });

  test('returns false for empty string', () => {
    expect(isHtmlContentType('')).toBe(false);
  });
});

describe('supportsGzipEncoding', () => {
  test('returns true for gzip', () => {
    expect(supportsGzipEncoding('gzip')).toBe(true);
  });

  test('returns true for gzip, deflate', () => {
    expect(supportsGzipEncoding('gzip, deflate')).toBe(true);
  });

  test('returns true for deflate, gzip, br', () => {
    expect(supportsGzipEncoding('deflate, gzip, br')).toBe(true);
  });

  test('returns false for deflate only', () => {
    expect(supportsGzipEncoding('deflate')).toBe(false);
  });

  test('returns false for empty string', () => {
    expect(supportsGzipEncoding('')).toBe(false);
  });

  test('returns false for identity', () => {
    expect(supportsGzipEncoding('identity')).toBe(false);
  });
});

describe('transformHtmlResponse', () => {
  const sampleHtml = '<!DOCTYPE html><html><head></head><body>Hello</body></html>';

  test('returns uncompressed body when gzip not supported', () => {
    const result = transformHtmlResponse(sampleHtml, false);
    expect(result.headers['content-encoding']).toBeUndefined();
    expect(result.headers['content-length']).toBeDefined();
    expect(result.body.toString()).toContain('Hello');
  });

  test('returns gzip compressed body when gzip supported', () => {
    const result = transformHtmlResponse(sampleHtml, true);
    expect(result.headers['content-encoding']).toBe('gzip');
    expect(result.headers['content-length']).toBeDefined();

    // Verify it's actually gzip compressed
    const decompressed = gunzipSync(result.body).toString();
    expect(decompressed).toContain('Hello');
  });

  test('injects IME helper into HTML', () => {
    const result = transformHtmlResponse(sampleHtml, false);
    const html = result.body.toString();
    // IME helper should be injected before </body>
    expect(html).toContain('ttyd-ime-container');
  });

  test('sets correct content-length for uncompressed', () => {
    const result = transformHtmlResponse(sampleHtml, false);
    const expectedLength = Buffer.byteLength(result.body);
    expect(result.headers['content-length']).toBe(String(expectedLength));
  });

  test('sets correct content-length for compressed', () => {
    const result = transformHtmlResponse(sampleHtml, true);
    expect(result.headers['content-length']).toBe(String(result.body.length));
  });

  test('handles empty HTML', () => {
    const result = transformHtmlResponse('', false);
    expect(result.body).toBeDefined();
    expect(result.headers['content-length']).toBeDefined();
  });

  test('handles HTML with special characters', () => {
    const htmlWithSpecial = '<html><body>日本語テスト</body></html>';
    const result = transformHtmlResponse(htmlWithSpecial, false);
    expect(result.body.toString()).toContain('日本語テスト');
  });

  test('handles large HTML content', () => {
    const largeHtml = '<html><body>' + 'x'.repeat(100000) + '</body></html>';
    const result = transformHtmlResponse(largeHtml, true);
    const decompressed = gunzipSync(result.body).toString();
    expect(decompressed).toContain('x'.repeat(100));
  });
});
