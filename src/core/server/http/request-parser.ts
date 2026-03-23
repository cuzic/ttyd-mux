/**
 * Request Parser Layer
 *
 * Utilities for parsing and validating request data using Zod.
 */

import { type ZodError, type ZodType, z } from 'zod';
import { type ValidationError, validationFailed } from '@/core/errors.js';
import { err, ok, type Result } from '@/utils/result.js';

// === Parse Results ===

export type ParseResult<T> = Result<T, ValidationError>;

// === Common Schemas ===

/**
 * Session name schema - non-empty string
 */
export const SessionNameSchema = z
  .string()
  .min(1, 'Session name is required')
  .max(64, 'Session name too long');

/**
 * Block ID schema - non-empty string
 */
export const BlockIdSchema = z.string().min(1, 'Block ID is required');

/**
 * Pagination schema
 */
export const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0)
});

/**
 * Session path parameter schema
 */
export const SessionPathSchema = z.object({
  name: SessionNameSchema
});

// === Parser Functions ===

/**
 * Parse request JSON body with schema validation
 */
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<ParseResult<T>> {
  try {
    const raw = await req.json();
    const result = schema.safeParse(raw);
    if (!result.success) {
      return err(zodToValidationError(result.error));
    }
    return ok(result.data);
  } catch {
    return err(validationFailed('body', 'Invalid JSON'));
  }
}

/**
 * Parse URL query parameters with schema validation
 */
export function parseQuery<T>(req: Request, schema: ZodType<T>): ParseResult<T> {
  const url = new URL(req.url);
  const raw = Object.fromEntries(url.searchParams);
  const result = schema.safeParse(raw);
  if (!result.success) {
    return err(zodToValidationError(result.error));
  }
  return ok(result.data);
}

/**
 * Parse path parameters with schema validation
 */
export function parsePathParams<T>(
  params: Record<string, string>,
  schema: ZodType<T>
): ParseResult<T> {
  const result = schema.safeParse(params);
  if (!result.success) {
    return err(zodToValidationError(result.error));
  }
  return ok(result.data);
}

/**
 * Extract session name from path
 * e.g., '/sessions/my-session/blocks' → 'my-session'
 */
export function extractSessionName(apiPath: string): string | null {
  const match = apiPath.match(/^\/sessions\/([^/]+)/);
  const captured = match?.[1];
  return captured ? decodeURIComponent(captured) : null;
}

/**
 * Extract block ID from path
 * e.g., '/sessions/my-session/blocks/block-123' → 'block-123'
 */
export function extractBlockId(apiPath: string): string | null {
  const match = apiPath.match(/\/blocks\/([^/]+)/);
  const captured = match?.[1];
  return captured ? decodeURIComponent(captured) : null;
}

// === Zod to Domain Error ===

/**
 * Convert Zod error to domain ValidationError
 */
export function zodToValidationError(error: ZodError): ValidationError {
  const firstIssue = error.issues[0];
  const field = firstIssue?.path.join('.') || 'unknown';
  const reason = firstIssue?.message || 'Invalid value';
  return validationFailed(field, reason);
}

// === Session Request Schemas ===

export const CreateSessionBodySchema = z.object({
  name: SessionNameSchema,
  dir: z.string().optional(),
  tmuxSession: z.string().optional()
});

export type CreateSessionBody = z.infer<typeof CreateSessionBodySchema>;

// === Command Request Schemas ===

export const ExecuteCommandBodySchema = z.object({
  command: z.string().min(1, 'Command is required'),
  cwd: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
  timeout: z.number().int().min(0).optional()
});

export type ExecuteCommandBody = z.infer<typeof ExecuteCommandBodySchema>;

// === File Request Schemas ===

export const FileUploadQuerySchema = z.object({
  session: SessionNameSchema,
  path: z.string().optional()
});

export type FileUploadQuery = z.infer<typeof FileUploadQuerySchema>;

// === Share Request Schemas ===

export const CreateShareBodySchema = z.object({
  sessionName: SessionNameSchema,
  expiresIn: z.string().optional().default('1h'),
  password: z.string().optional()
});

export type CreateShareBody = z.infer<typeof CreateShareBodySchema>;

// === AI Request Schemas ===

export const AiRunBodySchema = z.object({
  sessionName: SessionNameSchema,
  prompt: z.string().min(1, 'Prompt is required'),
  runner: z.enum(['claude', 'codex', 'gemini']).optional().default('claude'),
  mode: z.enum(['run', 'stream']).optional().default('run')
});

export type AiRunBody = z.infer<typeof AiRunBodySchema>;
