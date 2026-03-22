/**
 * Browser API Response Schemas
 *
 * Zod schemas for validating API responses in the browser.
 */

import { z } from 'zod';

// === File Transfer Schemas ===

export const FileInfoSchema = z.object({
  name: z.string(),
  size: z.number(),
  isDirectory: z.boolean(),
  modifiedAt: z.string()
});

export type FileInfo = z.infer<typeof FileInfoSchema>;

export const ListFilesResponseSchema = z.object({
  files: z.array(FileInfoSchema)
});

// === Clipboard Schemas ===

export const UploadImagesResponseSchema = z.object({
  success: z.boolean(),
  paths: z.array(z.string()),
  error: z.string().optional()
});

// === Notifications Schemas ===

export const VapidKeyResponseSchema = z.object({
  publicKey: z.string()
});

export const SubscribeResponseSchema = z.object({
  id: z.string()
});

// === Share Schemas ===

export const ShareLinkSchema = z.object({
  token: z.string(),
  sessionName: z.string(),
  expiresAt: z.string()
});

export type ShareLink = z.infer<typeof ShareLinkSchema>;

// === Upload Schemas ===

export const UploadFileResponseSchema = z.object({
  success: z.boolean(),
  path: z.string()
});

// === Session Schemas ===

export const SessionInfoSchema = z.object({
  name: z.string(),
  dir: z.string(),
  path: z.string(),
  fullPath: z.string()
});

export type SessionInfo = z.infer<typeof SessionInfoSchema>;

export const TmuxSessionInfoSchema = z.object({
  name: z.string(),
  windows: z.number(),
  created: z.string(),
  attached: z.boolean()
});

export type TmuxSessionInfo = z.infer<typeof TmuxSessionInfoSchema>;

export const TmuxSessionsResponseSchema = z.object({
  sessions: z.array(TmuxSessionInfoSchema),
  installed: z.boolean()
});

// === AI Chat Schemas ===

export const AIRunnerStatusSchema = z.object({
  name: z.string(),
  available: z.boolean(),
  enabled: z.boolean(),
  reason: z.string().optional()
});

export type AIRunnerStatus = z.infer<typeof AIRunnerStatusSchema>;

export const AIRunnersResponseSchema = z.object({
  runners: z.array(AIRunnerStatusSchema)
});

export const AITokenResponseSchema = z.object({
  token: z.string()
});

// === Parse Helpers ===

/**
 * Safely parse JSON with schema validation
 * Returns null on validation failure
 */
export function parseWithSchema<T>(
  data: unknown,
  schema: z.ZodSchema<T>
): T | null {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  return null;
}

/**
 * Parse JSON or throw with detailed error
 */
export function parseWithSchemaOrThrow<T>(
  data: unknown,
  schema: z.ZodSchema<T>,
  context: string
): T {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  const issue = result.error.issues[0];
  throw new Error(
    `${context}: ${issue?.path.join('.') || 'root'} - ${issue?.message ?? 'validation failed'}`
  );
}
