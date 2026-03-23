/**
 * Shares API Routes
 *
 * Handles share link management: create, validate, revoke.
 */

import { z } from 'zod';
import { notFound, sessionNotFound, validationFailed } from '@/core/errors.js';
import type { RouteDef } from '@/core/server/http/route-types.js';
import { shareManager } from '@/core/server/http/routes/page-routes.js';
import { err, ok } from '@/utils/result.js';

// === Schemas ===

const CreateShareBodySchema = z.object({
  sessionName: z.string().min(1, 'sessionName is required'),
  expiresIn: z.string().optional().default('1h')
});

// === Routes ===

export const sharesRoutes: RouteDef[] = [
  {
    method: 'GET',
    path: '/api/shares',
    description: 'List all shares',
    tags: ['shares'],
    handler: async () => {
      const shares = shareManager.listShares();
      return ok(shares);
    }
  },

  {
    method: 'POST',
    path: '/api/shares',
    bodySchema: CreateShareBodySchema,
    description: 'Create a new share link',
    tags: ['shares'],
    handler: async (ctx) => {
      const { sessionName, expiresIn } = ctx.body as z.infer<typeof CreateShareBodySchema>;

      if (!ctx.sessionManager.hasSession(sessionName)) {
        return err(sessionNotFound(sessionName));
      }

      const share = shareManager.createShare(sessionName, { expiresIn });
      return ok(share);
    }
  },

  {
    method: 'GET',
    path: '/api/shares/:token',
    description: 'Validate a share link',
    tags: ['shares'],
    handler: async (ctx) => {
      const token = ctx.pathParams['token'];
      if (!token) {
        return err(validationFailed('token', 'Token is required'));
      }
      const share = shareManager.validateShare(token);

      if (!share) {
        return err(notFound('Share not found or expired'));
      }

      return ok(share);
    }
  },

  {
    method: 'DELETE',
    path: '/api/shares/:token',
    description: 'Revoke a share link',
    tags: ['shares'],
    handler: async (ctx) => {
      const token = ctx.pathParams['token'];
      if (!token) {
        return err(validationFailed('token', 'Token is required'));
      }
      const success = shareManager.revokeShare(token);

      if (!success) {
        return err(notFound('Share not found'));
      }

      return ok({ success: true });
    }
  }
];

// === Legacy Handler (deprecated) ===

/**
 * @deprecated Use sharesRoutes with RouteRegistry instead
 */
export async function handleSharesRoutes(): Promise<Response | null> {
  return null;
}
