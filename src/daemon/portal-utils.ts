/**
 * Shared utilities for portal HTML generation
 */

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate PWA meta tags and links
 */
export function generatePwaHead(basePath: string): string {
  return `
  <meta name="theme-color" content="#00d9ff">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="ttyd-mux">
  <link rel="manifest" href="${basePath}/manifest.json">
  <link rel="apple-touch-icon" href="${basePath}/icon-192.png">
  <link rel="icon" type="image/svg+xml" href="${basePath}/icon.svg">`;
}

/**
 * Generate Service Worker registration script
 */
export function generateSwRegistration(basePath: string): string {
  return `
  <script>
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('${basePath}/sw.js')
        .catch(err => console.warn('SW registration failed:', err));
    }
  </script>`;
}

/**
 * Common CSS styles for portal pages
 */
export const portalStyles = `
    * {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      background: #1a1a2e;
      color: #eee;
      min-height: 100vh;
    }
    h1 {
      color: #00d9ff;
      margin-bottom: 0.5rem;
    }
    .subtitle {
      color: #888;
      margin-bottom: 2rem;
    }
    ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .session {
      margin: 0.5rem 0;
    }
    .session a {
      display: block;
      padding: 1rem;
      background: #16213e;
      border-radius: 8px;
      text-decoration: none;
      color: #eee;
      transition: background 0.2s, transform 0.1s;
    }
    .session a:hover {
      background: #1f3460;
      transform: translateX(4px);
    }
    .name {
      font-weight: 600;
      font-size: 1.1rem;
      color: #00d9ff;
    }
    .info {
      display: block;
      font-size: 0.85rem;
      color: #888;
      margin-top: 0.25rem;
    }
    .no-sessions {
      color: #888;
      padding: 2rem;
      text-align: center;
      background: #16213e;
      border-radius: 8px;
    }
    code {
      background: #0f0f23;
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      font-family: "SF Mono", Monaco, "Cascadia Code", monospace;
    }`;
