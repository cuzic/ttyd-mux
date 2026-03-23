/**
 * Core Server Module
 *
 * Server infrastructure components for the daemon.
 */

// HTTP Handler
export { handleHttpRequest } from './http-handler.js';
// Portal
export { generateJsonResponse, generatePortalHtml } from './portal.js';
// Portal Utils
export {
  directoryBrowserStyles,
  escapeHtml,
  generatePwaHead,
  generateSwRegistration,
  portalStyles
} from './portal-utils.js';
// PWA
export {
  generateManifest,
  getIconPng,
  getIconSvg,
  getManifestJson,
  getServiceWorker
} from './pwa.js';
// Session Manager
export {
  NativeSessionManager,
  type NativeSessionOptions,
  type NativeSessionState
} from './session-manager.js';
// WebSocket Handler
export {
  type AuthenticatedWebSocketData,
  createNativeTerminalWebSocketHandlers,
  isNativeTerminalHtmlPath,
  isNativeTerminalWebSocketPath,
  type NativeTerminalWebSocketHandlerOptions
} from './ws-handler.js';
