/**
 * Route Executor Tests
 */

import { describe, test, expect, mock } from 'bun:test';
import { z } from 'zod';
import { ok, err } from '@/utils/result.js';
import { sessionNotFound, validationFailed } from '@/core/errors.js';
import type { RouteDef, RouteDeps, RouteContext } from './route-types.js';
import {
  executeRoute,
  successResponse,
  errorEnvelopeResponse,
  validationErrorResponse,
  resultToResponse,
  generateRequestId
} from './route-executor.js';

// === Test Helpers ===

function createMockDeps(): RouteDeps {
  return {
    sessionManager: {} as RouteDeps['sessionManager'],
    config: {} as RouteDeps['config'],
    basePath: '/bunterm',
    sentryEnabled: false
  };
}

function createMockRequest(
  method: string,
  url: string,
  body?: object
): Request {
  const init: RequestInit = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  return new Request(url, init);
}

async function parseResponseJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

// === generateRequestId Tests ===

describe('generateRequestId', () => {
  test('generates unique IDs', () => {
    const id1 = generateRequestId();
    const id2 = generateRequestId();
    expect(id1).not.toBe(id2);
  });

  test('generates IDs with correct prefix', () => {
    const id = generateRequestId();
    expect(id.startsWith('req_')).toBe(true);
  });

  test('generates IDs with expected format', () => {
    const id = generateRequestId();
    expect(id).toMatch(/^req_[a-z0-9]+_[a-z0-9]+$/);
  });
});

// === successResponse Tests ===

describe('successResponse', () => {
  test('creates success envelope with data', async () => {
    const data = { name: 'test', count: 42 };
    const res = successResponse(data, 'req_123');

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/json');

    const body = await parseResponseJson<{ success: boolean; data: typeof data; requestId: string }>(res);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(data);
    expect(body.requestId).toBe('req_123');
  });

  test('allows custom status code', async () => {
    const res = successResponse({ created: true }, 'req_456', { status: 201 });
    expect(res.status).toBe(201);
  });

  test('includes security headers', async () => {
    const res = successResponse({}, 'req_789');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });
});

// === errorEnvelopeResponse Tests ===

describe('errorEnvelopeResponse', () => {
  test('creates error envelope from domain error', async () => {
    const error = sessionNotFound('my-session');
    const res = errorEnvelopeResponse(error, 'req_err');

    expect(res.status).toBe(404);

    const body = await parseResponseJson<{ success: boolean; error: { code: string; message: string }; requestId: string }>(res);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('SESSION_NOT_FOUND');
    expect(body.error.message).toContain('my-session');
    expect(body.requestId).toBe('req_err');
  });

  test('maps validation error to 400', async () => {
    const error = validationFailed('name', 'required');
    const res = errorEnvelopeResponse(error, 'req_val');

    expect(res.status).toBe(400);
  });
});

// === validationErrorResponse Tests ===

describe('validationErrorResponse', () => {
  test('creates error response from Zod error', async () => {
    const schema = z.object({
      name: z.string().min(1),
      count: z.number()
    });

    const result = schema.safeParse({ name: '', count: 'not-a-number' });
    if (result.success) throw new Error('Expected validation failure');

    const res = validationErrorResponse(result.error, 'req_zod');

    expect(res.status).toBe(400);

    const body = await parseResponseJson<{ success: boolean; error: { code: string } }>(res);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_FAILED');
  });
});

// === resultToResponse Tests ===

describe('resultToResponse', () => {
  test('converts Ok result to success response', async () => {
    const result = ok({ items: [1, 2, 3] });
    const res = resultToResponse(result, 'req_ok');

    expect(res.status).toBe(200);

    const body = await parseResponseJson<{ success: boolean; data: { items: number[] } }>(res);
    expect(body.success).toBe(true);
    expect(body.data.items).toEqual([1, 2, 3]);
  });

  test('converts Err result to error response', async () => {
    const result = err(sessionNotFound('test'));
    const res = resultToResponse(result, 'req_err');

    expect(res.status).toBe(404);

    const body = await parseResponseJson<{ success: boolean; error: { code: string } }>(res);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('SESSION_NOT_FOUND');
  });
});

// === executeRoute Tests ===

describe('executeRoute', () => {
  test('executes simple GET handler', async () => {
    const route: RouteDef<unknown, unknown, { message: string }> = {
      method: 'GET',
      path: '/api/test',
      handler: async () => ok({ message: 'hello' })
    };

    const req = createMockRequest('GET', 'http://localhost/api/test');
    const res = await executeRoute(route, req, {}, createMockDeps());

    expect(res.status).toBe(200);

    const body = await parseResponseJson<{ success: boolean; data: { message: string } }>(res);
    expect(body.success).toBe(true);
    expect(body.data.message).toBe('hello');
  });

  test('parses and validates request body', async () => {
    const bodySchema = z.object({
      name: z.string(),
      value: z.number()
    });

    const route: RouteDef<unknown, z.infer<typeof bodySchema>, { received: boolean }> = {
      method: 'POST',
      path: '/api/items',
      bodySchema,
      handler: async (ctx) => {
        expect(ctx.body.name).toBe('test');
        expect(ctx.body.value).toBe(123);
        return ok({ received: true });
      }
    };

    const req = createMockRequest('POST', 'http://localhost/api/items', {
      name: 'test',
      value: 123
    });

    const res = await executeRoute(route, req, {}, createMockDeps());
    expect(res.status).toBe(200);
  });

  test('returns validation error for invalid body', async () => {
    const bodySchema = z.object({
      name: z.string().min(1)
    });

    const route: RouteDef<unknown, z.infer<typeof bodySchema>, unknown> = {
      method: 'POST',
      path: '/api/items',
      bodySchema,
      handler: async () => ok({})
    };

    const req = createMockRequest('POST', 'http://localhost/api/items', {
      name: '' // invalid: empty string
    });

    const res = await executeRoute(route, req, {}, createMockDeps());

    expect(res.status).toBe(400);

    const body = await parseResponseJson<{ success: boolean; error: { code: string } }>(res);
    expect(body.error.code).toBe('VALIDATION_FAILED');
  });

  test('parses query parameters', async () => {
    const querySchema = z.object({
      limit: z.coerce.number().default(10),
      offset: z.coerce.number().default(0)
    });

    const route: RouteDef<z.infer<typeof querySchema>, unknown, { limit: number; offset: number }> = {
      method: 'GET',
      path: '/api/items',
      querySchema,
      handler: async (ctx) => {
        return ok({ limit: ctx.params.limit, offset: ctx.params.offset });
      }
    };

    const req = createMockRequest('GET', 'http://localhost/api/items?limit=20&offset=5');
    const res = await executeRoute(route, req, {}, createMockDeps());

    expect(res.status).toBe(200);

    const body = await parseResponseJson<{ data: { limit: number; offset: number } }>(res);
    expect(body.data.limit).toBe(20);
    expect(body.data.offset).toBe(5);
  });

  test('passes path params to handler', async () => {
    const route: RouteDef<unknown, unknown, { name: string }> = {
      method: 'GET',
      path: '/api/sessions/:name',
      handler: async (ctx) => {
        return ok({ name: ctx.pathParams.name });
      }
    };

    const req = createMockRequest('GET', 'http://localhost/api/sessions/my-session');
    const res = await executeRoute(route, req, { name: 'my-session' }, createMockDeps());

    expect(res.status).toBe(200);

    const body = await parseResponseJson<{ data: { name: string } }>(res);
    expect(body.data.name).toBe('my-session');
  });

  test('provides request ID in context', async () => {
    let capturedRequestId = '';

    const route: RouteDef = {
      method: 'GET',
      path: '/api/test',
      handler: async (ctx) => {
        capturedRequestId = ctx.requestId;
        return ok({});
      }
    };

    const req = createMockRequest('GET', 'http://localhost/api/test');
    await executeRoute(route, req, {}, createMockDeps());

    expect(capturedRequestId).toMatch(/^req_/);
  });

  test('handles handler errors with 500 response', async () => {
    const route: RouteDef = {
      method: 'GET',
      path: '/api/error',
      handler: async () => {
        throw new Error('Unexpected error');
      }
    };

    const req = createMockRequest('GET', 'http://localhost/api/error');
    const res = await executeRoute(route, req, {}, createMockDeps());

    expect(res.status).toBe(500);

    const body = await parseResponseJson<{ success: boolean; error: { code: string } }>(res);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  test('handles handler returning error result', async () => {
    const route: RouteDef = {
      method: 'GET',
      path: '/api/sessions/:name',
      handler: async (ctx) => {
        return err(sessionNotFound(ctx.pathParams.name));
      }
    };

    const req = createMockRequest('GET', 'http://localhost/api/sessions/missing');
    const res = await executeRoute(route, req, { name: 'missing' }, createMockDeps());

    expect(res.status).toBe(404);

    const body = await parseResponseJson<{ error: { code: string } }>(res);
    expect(body.error.code).toBe('SESSION_NOT_FOUND');
  });

  test('does not parse body for GET requests', async () => {
    const bodySchema = z.object({ name: z.string() });

    const route: RouteDef<unknown, z.infer<typeof bodySchema>, { ok: boolean }> = {
      method: 'GET',
      path: '/api/test',
      bodySchema, // should be ignored for GET
      handler: async () => ok({ ok: true })
    };

    const req = createMockRequest('GET', 'http://localhost/api/test');
    const res = await executeRoute(route, req, {}, createMockDeps());

    expect(res.status).toBe(200);
  });
});
