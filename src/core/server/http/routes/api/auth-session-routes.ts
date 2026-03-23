/**
 * Auth Session API Routes
 *
 * Endpoints for listing and revoking authenticated cookie sessions.
 */

import { notFound } from '@/core/errors.js';
import type { CookieSessionStore } from '@/core/server/auth/cookie-session.js';
import type { RouteDef } from '@/core/server/http/route-types.js';
import { err, ok } from '@/utils/result.js';

// === Types ===

export interface AuthSessionRouteDeps {
  cookieSessionStore: CookieSessionStore;
}

interface AuthSessionResponse {
  /** Short prefix of session ID (first 8 chars) for display */
  id: string;
  /** Remote IP address */
  remoteAddr: string;
  /** ISO 8601 creation time */
  createdAt: string;
  /** ISO 8601 expiration time */
  expiresAt: string;
}

// === Singleton ===

let depsInstance: AuthSessionRouteDeps | null = null;

/** Set auth session route deps (called from server init) */
export function setAuthSessionRouteDeps(deps: AuthSessionRouteDeps): void {
  depsInstance = deps;
}

// === Helpers ===

/** Truncate session ID to short prefix for display (security: never expose full ID) */
function shortId(id: string): string {
  return id.slice(0, 8);
}

// === Routes ===

export const authSessionRoutes: RouteDef[] = [
  {
    method: 'GET',
    path: '/api/auth/sessions',
    description: 'List active authenticated sessions',
    tags: ['auth'],
    handler: () => {
      if (!depsInstance) {
        return ok<AuthSessionResponse[]>([]);
      }

      const sessions = depsInstance.cookieSessionStore.listSessions();
      const response: AuthSessionResponse[] = sessions.map((s) => ({
        id: shortId(s.id),
        remoteAddr: s.remoteAddr,
        createdAt: new Date(s.createdAt).toISOString(),
        expiresAt: new Date(s.expiresAt).toISOString()
      }));

      return ok(response);
    }
  },

  {
    method: 'DELETE',
    path: '/api/auth/sessions/:id',
    description: 'Revoke an authenticated session',
    tags: ['auth'],
    handler: (ctx) => {
      const shortSessionId = ctx.pathParams['id'];
      if (!shortSessionId) {
        return err(notFound('/api/auth/sessions/'));
      }

      if (!depsInstance) {
        return err(notFound(`/api/auth/sessions/${shortSessionId}`));
      }

      // Find the full session ID matching the short prefix
      const sessions = depsInstance.cookieSessionStore.listSessions();
      const target = sessions.find((s) => s.id.startsWith(shortSessionId));

      if (!target) {
        return err(notFound(`/api/auth/sessions/${shortSessionId}`));
      }

      depsInstance.cookieSessionStore.revoke(target.id);
      return ok({ revoked: true, id: shortSessionId });
    }
  }
];
