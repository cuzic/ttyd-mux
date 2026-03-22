/**
 * Request Parser Tests
 */

import { describe, test, expect } from 'bun:test';
import { isOk, isErr } from '@/utils/result.js';
import {
  parseBody,
  parseQuery,
  parsePathParams,
  extractSessionName,
  extractBlockId,
  zodToValidationError,
  SessionNameSchema,
  BlockIdSchema,
  PaginationSchema,
  SessionPathSchema,
  CreateSessionBodySchema,
  ExecuteCommandBodySchema,
  FileUploadQuerySchema,
  CreateShareBodySchema,
  AiRunBodySchema
} from './request-parser.js';
import { z } from 'zod';

// === parseBody Tests ===

describe('parseBody', () => {
  test('parses valid JSON body', async () => {
    const schema = z.object({ name: z.string() });
    const req = new Request('http://localhost/test', {
      method: 'POST',
      body: JSON.stringify({ name: 'test' }),
      headers: { 'Content-Type': 'application/json' }
    });

    const result = await parseBody(req, schema);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.name).toBe('test');
    }
  });

  test('returns error for invalid JSON', async () => {
    const schema = z.object({ name: z.string() });
    const req = new Request('http://localhost/test', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' }
    });

    const result = await parseBody(req, schema);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('VALIDATION_FAILED');
      expect(result.error.field).toBe('body');
    }
  });

  test('returns error for schema validation failure', async () => {
    const schema = z.object({ name: z.string().min(1) });
    const req = new Request('http://localhost/test', {
      method: 'POST',
      body: JSON.stringify({ name: '' }),
      headers: { 'Content-Type': 'application/json' }
    });

    const result = await parseBody(req, schema);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('VALIDATION_FAILED');
    }
  });
});

// === parseQuery Tests ===

describe('parseQuery', () => {
  test('parses query parameters', () => {
    const schema = z.object({
      limit: z.coerce.number(),
      offset: z.coerce.number()
    });
    const req = new Request('http://localhost/test?limit=10&offset=5');

    const result = parseQuery(req, schema);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.limit).toBe(10);
      expect(result.value.offset).toBe(5);
    }
  });

  test('returns error for invalid query parameters', () => {
    const schema = z.object({
      limit: z.coerce.number().min(1)
    });
    const req = new Request('http://localhost/test?limit=0');

    const result = parseQuery(req, schema);
    expect(isErr(result)).toBe(true);
  });

  test('handles missing optional parameters', () => {
    const schema = z.object({
      page: z.coerce.number().optional().default(1)
    });
    const req = new Request('http://localhost/test');

    const result = parseQuery(req, schema);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.page).toBe(1);
    }
  });
});

// === parsePathParams Tests ===

describe('parsePathParams', () => {
  test('parses path parameters', () => {
    const schema = z.object({ id: z.string() });
    const params = { id: '123' };

    const result = parsePathParams(params, schema);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.id).toBe('123');
    }
  });

  test('returns error for invalid path parameters', () => {
    const schema = z.object({ id: z.string().min(5) });
    const params = { id: '12' };

    const result = parsePathParams(params, schema);
    expect(isErr(result)).toBe(true);
  });
});

// === extractSessionName Tests ===

describe('extractSessionName', () => {
  test('extracts session name from path', () => {
    expect(extractSessionName('/sessions/my-session')).toBe('my-session');
    expect(extractSessionName('/sessions/test/blocks')).toBe('test');
  });

  test('decodes URL-encoded names', () => {
    expect(extractSessionName('/sessions/my%20session')).toBe('my session');
  });

  test('returns null for non-matching paths', () => {
    expect(extractSessionName('/other/path')).toBeNull();
    expect(extractSessionName('/sessions')).toBeNull();
    // '/sessions/' with trailing slash returns empty string after decodeURIComponent
    // But the regex requires at least one character after /sessions/
    expect(extractSessionName('/sessions/')).toBeNull();
  });
});

// === extractBlockId Tests ===

describe('extractBlockId', () => {
  test('extracts block ID from path', () => {
    expect(extractBlockId('/sessions/test/blocks/blk-123')).toBe('blk-123');
  });

  test('decodes URL-encoded IDs', () => {
    expect(extractBlockId('/blocks/block%2D123')).toBe('block-123');
  });

  test('returns null for non-matching paths', () => {
    expect(extractBlockId('/sessions/test')).toBeNull();
    expect(extractBlockId('/blocks')).toBeNull();
  });
});

// === zodToValidationError Tests ===

describe('zodToValidationError', () => {
  test('converts Zod error to ValidationError', () => {
    const schema = z.object({ name: z.string().min(1, 'Name is required') });
    const result = schema.safeParse({ name: '' });

    if (!result.success) {
      const error = zodToValidationError(result.error);
      expect(error.code).toBe('VALIDATION_FAILED');
      expect(error.field).toBe('name');
      expect(error.reason).toBe('Name is required');
    }
  });

  test('handles nested field paths', () => {
    const schema = z.object({
      user: z.object({
        profile: z.object({
          name: z.string().min(1)
        })
      })
    });
    const result = schema.safeParse({ user: { profile: { name: '' } } });

    if (!result.success) {
      const error = zodToValidationError(result.error);
      expect(error.field).toBe('user.profile.name');
    }
  });
});

// === Schema Tests ===

describe('SessionNameSchema', () => {
  test('accepts valid session names', () => {
    expect(SessionNameSchema.safeParse('my-session').success).toBe(true);
    expect(SessionNameSchema.safeParse('a').success).toBe(true);
  });

  test('rejects empty strings', () => {
    expect(SessionNameSchema.safeParse('').success).toBe(false);
  });

  test('rejects too long names', () => {
    const longName = 'a'.repeat(65);
    expect(SessionNameSchema.safeParse(longName).success).toBe(false);
  });
});

describe('BlockIdSchema', () => {
  test('accepts valid block IDs', () => {
    expect(BlockIdSchema.safeParse('blk-123').success).toBe(true);
  });

  test('rejects empty strings', () => {
    expect(BlockIdSchema.safeParse('').success).toBe(false);
  });
});

describe('PaginationSchema', () => {
  test('accepts valid pagination params', () => {
    const result = PaginationSchema.safeParse({ limit: '10', offset: '5' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(10);
      expect(result.data.offset).toBe(5);
    }
  });

  test('uses defaults for missing params', () => {
    const result = PaginationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
      expect(result.data.offset).toBe(0);
    }
  });

  test('rejects invalid limit', () => {
    expect(PaginationSchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(PaginationSchema.safeParse({ limit: '101' }).success).toBe(false);
  });
});

describe('SessionPathSchema', () => {
  test('validates session path params', () => {
    const result = SessionPathSchema.safeParse({ name: 'my-session' });
    expect(result.success).toBe(true);
  });

  test('rejects missing name', () => {
    const result = SessionPathSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('CreateSessionBodySchema', () => {
  test('validates create session body', () => {
    const result = CreateSessionBodySchema.safeParse({ name: 'new-session' });
    expect(result.success).toBe(true);
  });

  test('accepts optional fields', () => {
    const result = CreateSessionBodySchema.safeParse({
      name: 'new-session',
      dir: '/home/user',
      tmuxSession: 'existing-tmux'
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dir).toBe('/home/user');
      expect(result.data.tmuxSession).toBe('existing-tmux');
    }
  });
});

describe('ExecuteCommandBodySchema', () => {
  test('validates command execution body', () => {
    const result = ExecuteCommandBodySchema.safeParse({ command: 'ls -la' });
    expect(result.success).toBe(true);
  });

  test('rejects empty command', () => {
    const result = ExecuteCommandBodySchema.safeParse({ command: '' });
    expect(result.success).toBe(false);
  });

  test('accepts optional fields', () => {
    const result = ExecuteCommandBodySchema.safeParse({
      command: 'npm run build',
      cwd: '/app',
      env: { NODE_ENV: 'production' },
      timeout: 30000
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.env?.NODE_ENV).toBe('production');
    }
  });
});

describe('FileUploadQuerySchema', () => {
  test('validates file upload query', () => {
    const result = FileUploadQuerySchema.safeParse({ session: 'my-session' });
    expect(result.success).toBe(true);
  });

  test('accepts optional path', () => {
    const result = FileUploadQuerySchema.safeParse({
      session: 'my-session',
      path: '/uploads'
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.path).toBe('/uploads');
    }
  });
});

describe('CreateShareBodySchema', () => {
  test('validates share creation body', () => {
    const result = CreateShareBodySchema.safeParse({ sessionName: 'my-session' });
    expect(result.success).toBe(true);
  });

  test('uses default expiresIn', () => {
    const result = CreateShareBodySchema.safeParse({ sessionName: 'test' });
    if (result.success) {
      expect(result.data.expiresIn).toBe('1h');
    }
  });

  test('accepts optional password', () => {
    const result = CreateShareBodySchema.safeParse({
      sessionName: 'test',
      password: 'secret123'
    });
    expect(result.success).toBe(true);
  });
});

describe('AiRunBodySchema', () => {
  test('validates AI run body', () => {
    const result = AiRunBodySchema.safeParse({
      sessionName: 'my-session',
      prompt: 'What is the weather?'
    });
    expect(result.success).toBe(true);
  });

  test('rejects empty prompt', () => {
    const result = AiRunBodySchema.safeParse({
      sessionName: 'test',
      prompt: ''
    });
    expect(result.success).toBe(false);
  });

  test('uses default runner and mode', () => {
    const result = AiRunBodySchema.safeParse({
      sessionName: 'test',
      prompt: 'Hello'
    });
    if (result.success) {
      expect(result.data.runner).toBe('claude');
      expect(result.data.mode).toBe('run');
    }
  });

  test('accepts different runners', () => {
    const runners = ['claude', 'codex', 'gemini'] as const;
    for (const runner of runners) {
      const result = AiRunBodySchema.safeParse({
        sessionName: 'test',
        prompt: 'Hello',
        runner
      });
      expect(result.success).toBe(true);
    }
  });
});
