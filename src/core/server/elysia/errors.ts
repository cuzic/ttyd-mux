/**
 * Common error response schemas for Elysia routes.
 *
 * Usage: per-status response schemas with set.status:
 *   response: { 200: SuccessSchema, 404: ErrorResponseSchema }
 *
 *   set.status = 404;
 *   return { error: 'NOT_FOUND', message: 'Resource not found' };
 */

import { t } from 'elysia';

/** Common error response schema for per-status response typing */
export const ErrorResponseSchema = t.Object({
  error: t.String(),
  message: t.String()
});
