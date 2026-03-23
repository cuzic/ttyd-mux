/**
 * Shared path utilities for extracting session names from URL paths.
 *
 * Consolidates duplicated logic from ws-handler.ts and page-routes.ts.
 */

/**
 * Strip basePath prefix from pathname, returning the rest or null if no match.
 */
function stripBasePath(pathname: string, basePath: string): string | null {
  const prefix = `${basePath}/`;
  if (!pathname.startsWith(prefix)) {
    return null;
  }
  return pathname.slice(prefix.length);
}

/**
 * Extract session name from a page path.
 * e.g., /bunterm/my-session → my-session
 *       /bunterm/my-session/ → my-session
 */
export function extractSessionFromPagePath(pathname: string, basePath: string): string | null {
  const rest = stripBasePath(pathname, basePath);
  if (rest === null) {
    return null;
  }

  let segment = rest;
  if (segment.endsWith('/')) {
    segment = segment.slice(0, -1);
  }

  if (segment.includes('/')) {
    return null;
  }

  return segment || null;
}

/**
 * Extract session name from a WebSocket path.
 * e.g., /bunterm/my-session/ws → my-session
 */
export function extractSessionFromWsPath(pathname: string, basePath: string): string | null {
  const rest = stripBasePath(pathname, basePath);
  if (rest === null) {
    return null;
  }

  if (!rest.endsWith('/ws')) {
    return null;
  }

  const sessionName = rest.slice(0, -3); // Remove '/ws'
  return sessionName || null;
}
