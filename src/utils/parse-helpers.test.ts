import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import {
  formatParseErrorResponse,
  isParseError,
  parseEnv,
  parseErrorToHttpStatus,
  parseJsonString,
  parsePathParams,
  parseQuery,
  parseUnknown
} from './parse-helpers.js';

describe('parseQuery', () => {
  const schema = z.object({
    limit: z.coerce.number().min(1).max(100).default(20),
    status: z.enum(['active', 'inactive']).optional()
  });

  test('parses valid query from URLSearchParams', () => {
    const params = new URLSearchParams('limit=50&status=active');
    const result = parseQuery(schema, 'query', params);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.limit).toBe(50);
      expect(result.value.status).toBe('active');
    }
  });

  test('parses valid query from URL', () => {
    const url = new URL('https://example.com/api?limit=30');
    const result = parseQuery(schema, 'query', url);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.limit).toBe(30);
    }
  });

  test('parses valid query from string', () => {
    const result = parseQuery(schema, 'query', 'limit=10');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.limit).toBe(10);
    }
  });

  test('applies default values', () => {
    const result = parseQuery(schema, 'query', new URLSearchParams());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.limit).toBe(20);
    }
  });

  test('returns error for invalid type', () => {
    const result = parseQuery(schema, 'query', 'limit=not-a-number');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('parse');
      expect(result.error.source).toBe('query');
    }
  });

  test('returns error for invalid enum value', () => {
    const result = parseQuery(schema, 'query', 'status=unknown');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_ENUM');
      expect(result.error.field).toBe('status');
    }
  });

  test('returns error for out of range', () => {
    const result = parseQuery(schema, 'query', 'limit=200');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('OUT_OF_RANGE');
    }
  });
});

describe('parseJsonString', () => {
  const schema = z.object({
    name: z.string().min(1),
    count: z.number()
  });

  test('parses valid JSON', () => {
    const result = parseJsonString(schema, 'json', '{"name":"test","count":5}');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('test');
      expect(result.value.count).toBe(5);
    }
  });

  test('returns error for invalid JSON syntax', () => {
    const result = parseJsonString(schema, 'json', '{invalid}');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PARSE_FAILED');
      expect(result.error.source).toBe('json');
    }
  });

  test('returns error for schema mismatch', () => {
    const result = parseJsonString(schema, 'file', '{"name":"","count":"not-a-number"}');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.source).toBe('file');
    }
  });
});

describe('parsePathParams', () => {
  const schema = z.object({
    id: z.string().min(1),
    version: z.coerce.number().int().min(1)
  });

  test('parses valid path params', () => {
    const result = parsePathParams(schema, { id: 'abc123', version: '2' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe('abc123');
      expect(result.value.version).toBe(2);
    }
  });

  test('returns error for missing required param', () => {
    const result = parsePathParams(schema, { id: 'abc123' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.source).toBe('path');
      expect(result.error.field).toBe('version');
    }
  });
});

describe('parseEnv', () => {
  const schema = z.object({
    PORT: z.coerce.number().default(3000),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info')
  });

  test('parses valid env', () => {
    const result = parseEnv(schema, { PORT: '8080', LOG_LEVEL: 'debug' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.PORT).toBe(8080);
      expect(result.value.LOG_LEVEL).toBe('debug');
    }
  });

  test('applies defaults', () => {
    const result = parseEnv(schema, {});

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.PORT).toBe(3000);
      expect(result.value.LOG_LEVEL).toBe('info');
    }
  });

  test('returns error for invalid value', () => {
    const result = parseEnv(schema, { LOG_LEVEL: 'invalid' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.source).toBe('env');
    }
  });
});

describe('parseUnknown', () => {
  const schema = z.object({
    status: z.enum(['running', 'stopped']),
    pid: z.number()
  });

  test('parses valid data', () => {
    const result = parseUnknown(schema, 'ws', { status: 'running', pid: 1234 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('running');
      expect(result.value.pid).toBe(1234);
    }
  });

  test('returns error for invalid data', () => {
    const result = parseUnknown(schema, 'ws', { status: 'unknown' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.source).toBe('ws');
    }
  });
});

describe('isParseError', () => {
  test('returns true for ParseError', () => {
    const error = {
      type: 'parse' as const,
      code: 'MISSING_FIELD' as const,
      source: 'query' as const,
      field: 'name',
      message: 'Missing field'
    };
    expect(isParseError(error)).toBe(true);
  });

  test('returns false for non-ParseError', () => {
    expect(isParseError({ code: 'NOT_FOUND' })).toBe(false);
    expect(isParseError(null)).toBe(false);
    expect(isParseError('error')).toBe(false);
  });
});

describe('parseErrorToHttpStatus', () => {
  test('returns 400 for validation errors', () => {
    const error = {
      type: 'parse' as const,
      code: 'MISSING_FIELD' as const,
      source: 'query' as const,
      field: 'name',
      message: 'Missing field'
    };
    expect(parseErrorToHttpStatus(error)).toBe(400);
  });

  test('returns 422 for non-body parse failures', () => {
    const error = {
      type: 'parse' as const,
      code: 'PARSE_FAILED' as const,
      source: 'json' as const,
      field: '_root',
      message: 'Invalid JSON'
    };
    expect(parseErrorToHttpStatus(error)).toBe(422);
  });
});

describe('formatParseErrorResponse', () => {
  test('formats error for HTTP response', () => {
    const error = {
      type: 'parse' as const,
      code: 'INVALID_TYPE' as const,
      source: 'query' as const,
      field: 'limit',
      message: 'Expected number',
      expected: 'number',
      received: 'string'
    };

    const response = formatParseErrorResponse(error);

    expect(response.error.type).toBe('parse');
    expect(response.error.code).toBe('INVALID_TYPE');
    expect(response.error.field).toBe('limit');
  });
});
