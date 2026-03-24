/**
 * Sessions API Routes (Elysia)
 *
 * Handles session management: list, create, delete sessions.
 * Replaces the old sessions-routes.ts with Elysia's TypeBox validation.
 */

import { Elysia, t } from 'elysia';
import { createTmuxClient } from '@/utils/tmux-client.js';
import { coreContext } from './context.js';
import { ErrorResponseSchema } from './errors.js';

// === Response Schemas ===

const SessionInfoSchema = t.Object({
  name: t.String(),
  pid: t.Number(),
  port: t.Number(),
  path: t.String(),
  dir: t.String(),
  started_at: t.String(),
  clients: t.Optional(t.Number()),
  tmuxSession: t.Optional(t.String())
});

const StatusResponseSchema = t.Object({
  daemon: t.Object({
    pid: t.Number(),
    port: t.Number(),
    backend: t.String()
  }),
  sessions: t.Array(SessionInfoSchema)
});

const SessionListItemSchema = t.Object({
  name: t.String(),
  pid: t.Number(),
  port: t.Number(),
  path: t.String(),
  dir: t.String(),
  started_at: t.String(),
  tmuxSession: t.Optional(t.String())
});

const TmuxSessionInfoSchema = t.Object({
  name: t.String(),
  windows: t.Number(),
  created: t.String(),
  attached: t.Boolean(),
  cwd: t.String()
});

const TmuxSessionsResponseSchema = t.Object({
  sessions: t.Array(TmuxSessionInfoSchema),
  installed: t.Boolean()
});

const CreateSessionBodySchema = t.Object({
  name: t.String({ minLength: 1 }),
  dir: t.Optional(t.String()),
  tmuxSession: t.Optional(t.String())
});

const CreateSessionResponseSchema = t.Object({
  name: t.String(),
  pid: t.Number(),
  path: t.String(),
  dir: t.String(),
  tmuxSession: t.Optional(t.String()),
  existing: t.Boolean()
});

const DeleteSessionResponseSchema = t.Object({
  success: t.Boolean()
});

// === Plugin ===

export const sessionsPlugin = new Elysia({ prefix: '/api' })
  .use(coreContext)

  // GET /api/status - daemon status + sessions list
  .get(
    '/status',
    ({ sessionManager, config }) => {
      const sessions = sessionManager.listSessions().map((s) => ({
        name: s.name,
        pid: s.pid,
        port: 0,
        path: `/${s.name}`,
        dir: s.dir,
        started_at: s.startedAt,
        clients: s.clientCount
      }));

      return {
        daemon: {
          pid: process.pid,
          port: config.daemon_port,
          backend: 'native' as const
        },
        sessions
      };
    },
    { response: StatusResponseSchema }
  )

  // GET /api/sessions - sessions array
  .get(
    '/sessions',
    ({ sessionManager }) => {
      return sessionManager.listSessions().map((s) => ({
        name: s.name,
        pid: s.pid,
        port: 0,
        path: `/${s.name}`,
        dir: s.dir,
        started_at: s.startedAt,
        tmuxSession: s.tmuxSession
      }));
    },
    { response: t.Array(SessionListItemSchema) }
  )

  // GET /api/tmux/sessions - tmux sessions
  .get(
    '/tmux/sessions',
    () => {
      const tmuxClient = createTmuxClient();
      const installed = tmuxClient.isInstalled();

      if (!installed) {
        return {
          sessions: [] as Array<{
            name: string;
            windows: number;
            created: string;
            attached: boolean;
            cwd: string;
          }>,
          installed: false
        };
      }

      const tmuxSessions = tmuxClient.listSessions();
      const sessions = tmuxSessions.map((s) => ({
        name: s.name,
        windows: s.windows,
        created: s.created.toISOString(),
        attached: s.attached,
        cwd: s.cwd ?? ''
      }));

      return { sessions, installed: true };
    },
    { response: TmuxSessionsResponseSchema }
  )

  // POST /api/sessions - create a session
  .post(
    '/sessions',
    async ({ sessionManager, config, body, set }) => {
      const { name, dir, tmuxSession } = body;

      // If tmuxSession is specified, check for existing wrapper FIRST
      if (tmuxSession) {
        const tmuxClient = createTmuxClient();
        if (!tmuxClient.isInstalled()) {
          set.status = 400;
          return { error: 'TMUX_NOT_INSTALLED', message: 'tmux is not installed' };
        }
        if (!tmuxClient.sessionExists(tmuxSession)) {
          set.status = 404;
          return {
            error: 'TMUX_SESSION_NOT_FOUND',
            message: `tmux session '${tmuxSession}' not found`
          };
        }

        // Check if there's already a bunterm session wrapping this tmux session
        const existingSessionName = sessionManager.findSessionByTmuxSession(tmuxSession);
        if (existingSessionName) {
          const existingSession = sessionManager.getSession(existingSessionName);
          if (existingSession) {
            return {
              name: existingSession.name,
              pid: existingSession.pid ?? 0,
              path: `/${existingSessionName}`,
              dir: existingSession.cwd,
              tmuxSession,
              existing: true
            };
          }
        }
      }

      // Check if session name already exists
      if (sessionManager.hasSession(name)) {
        set.status = 409;
        return {
          error: 'SESSION_ALREADY_EXISTS',
          message: `Session '${name}' already exists`
        };
      }

      const session = await sessionManager.createSession({
        name,
        dir: dir || process.cwd(),
        path: `${config.base_path}/${name}`,
        tmuxSession
      });

      set.status = 201;
      return {
        name: session.name,
        pid: session.pid ?? 0,
        path: `/${name}`,
        dir: session.cwd,
        tmuxSession,
        existing: false
      };
    },
    {
      body: CreateSessionBodySchema,
      response: {
        201: CreateSessionResponseSchema,
        400: ErrorResponseSchema,
        404: ErrorResponseSchema,
        409: ErrorResponseSchema
      }
    }
  )

  // DELETE /api/sessions/:name - delete a session
  .delete(
    '/sessions/:name',
    async ({ sessionManager, params, set }) => {
      const sessionName = params.name;

      if (!sessionManager.hasSession(sessionName)) {
        set.status = 404;
        return {
          error: 'SESSION_NOT_FOUND',
          message: `Session '${sessionName}' not found`
        };
      }

      await sessionManager.stopSession(sessionName);
      return { success: true };
    },
    {
      params: t.Object({ name: t.String() }),
      response: {
        200: DeleteSessionResponseSchema,
        404: ErrorResponseSchema
      }
    }
  );
