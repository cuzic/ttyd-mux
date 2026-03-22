/**
 * Sessions API Routes
 *
 * Handles session management: list, create, delete sessions.
 */

import type { ApiContext } from './types.js';
import { jsonResponse, errorResponse } from '../../utils.js';
import { createTmuxClient } from '@/utils/tmux-client.js';

/**
 * Handle sessions API routes
 */
export async function handleSessionsRoutes(ctx: ApiContext): Promise<Response | null> {
  const { apiPath, method, req, sessionManager, basePath, sentryEnabled } = ctx;

  // GET /api/status
  if (apiPath === '/status' && method === 'GET') {
    const sessions = sessionManager.listSessions().map((s) => ({
      name: s.name,
      pid: s.pid,
      port: 0,
      path: `/${s.name}`,
      dir: s.dir,
      started_at: s.startedAt,
      clients: s.clientCount
    }));

    return jsonResponse(
      {
        daemon: {
          pid: process.pid,
          port: ctx.config.daemon_port,
          backend: 'native'
        },
        sessions
      },
      { sentryEnabled }
    );
  }

  // GET /api/sessions
  if (apiPath === '/sessions' && method === 'GET') {
    const sessions = sessionManager.listSessions().map((s) => ({
      name: s.name,
      pid: s.pid,
      port: 0,
      path: `/${s.name}`,
      dir: s.dir,
      started_at: s.startedAt,
      tmuxSession: s.tmuxSession
    }));
    return jsonResponse(sessions, { sentryEnabled });
  }

  // GET /api/tmux/sessions
  if (apiPath === '/tmux/sessions' && method === 'GET') {
    const tmuxClient = createTmuxClient();
    const installed = tmuxClient.isInstalled();

    if (!installed) {
      return jsonResponse({ sessions: [], installed: false }, { sentryEnabled });
    }

    const tmuxSessions = tmuxClient.listSessions();
    const sessions = tmuxSessions.map((s) => ({
      name: s.name,
      windows: s.windows,
      created: s.created.toISOString(),
      attached: s.attached,
      cwd: s.cwd
    }));

    return jsonResponse({ sessions, installed: true }, { sentryEnabled });
  }

  // POST /api/sessions
  if (apiPath === '/sessions' && method === 'POST') {
    try {
      const body = await req.json();
      const { name, dir, tmuxSession } = body as {
        name?: string;
        dir?: string;
        tmuxSession?: string;
      };

      if (!name) {
        return errorResponse('Session name is required', 400, sentryEnabled);
      }

      // If tmuxSession is specified, check for existing wrapper FIRST
      if (tmuxSession) {
        const tmuxClient = createTmuxClient();
        if (!tmuxClient.isInstalled()) {
          return errorResponse('tmux is not installed', 400, sentryEnabled);
        }
        if (!tmuxClient.sessionExists(tmuxSession)) {
          return errorResponse(`tmux session "${tmuxSession}" not found`, 404, sentryEnabled);
        }

        // Check if there's already a bunterm session wrapping this tmux session
        const existingSessionName = sessionManager.findSessionByTmuxSession(tmuxSession);
        if (existingSessionName) {
          const existingSession = sessionManager.getSession(existingSessionName);
          if (existingSession) {
            return jsonResponse(
              {
                name: existingSession.name,
                pid: existingSession.pid,
                path: `/${existingSessionName}`,
                dir: existingSession.cwd,
                tmuxSession,
                existing: true
              },
              { status: 200, sentryEnabled }
            );
          }
        }
      }

      // Check if session name already exists
      if (sessionManager.hasSession(name)) {
        return errorResponse(`Session ${name} already exists`, 409, sentryEnabled);
      }

      const session = await sessionManager.createSession({
        name,
        dir: dir || process.cwd(),
        path: `${basePath}/${name}`,
        tmuxSession
      });

      return jsonResponse(
        {
          name: session.name,
          pid: session.pid,
          path: `/${name}`,
          dir: session.cwd,
          tmuxSession,
          existing: false
        },
        { status: 201, sentryEnabled }
      );
    } catch (error) {
      return errorResponse(String(error), 400, sentryEnabled);
    }
  }

  // DELETE /api/sessions/:name
  if (
    apiPath.startsWith('/sessions/') &&
    method === 'DELETE' &&
    !apiPath.includes('/commands') &&
    !apiPath.includes('/blocks') &&
    !apiPath.includes('/integration')
  ) {
    const sessionName = apiPath.slice('/sessions/'.length);

    if (!sessionManager.hasSession(sessionName)) {
      return errorResponse(`Session ${sessionName} not found`, 404, sentryEnabled);
    }

    try {
      await sessionManager.stopSession(sessionName);
      return jsonResponse({ success: true }, { sentryEnabled });
    } catch (error) {
      return errorResponse(String(error), 500, sentryEnabled);
    }
  }

  return null;
}
