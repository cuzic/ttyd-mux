/**
 * Terminal Toolbar Module
 *
 * Provides a toolbar for ttyd sessions with:
 * - IME input support for Japanese
 * - Font size zoom controls
 * - Copy/paste functionality
 * - Touch gesture support
 * - Modifier key buttons (Ctrl, Alt, Shift)
 */

import { DEFAULT_TOOLBAR_CONFIG, type ToolbarConfig } from '@/config/types.js';
import { AUTO_RUN_KEY, ONBOARDING_SHOWN_KEY, STORAGE_KEY } from './config.js';
import { toolbarStyles } from './styles.js';
import { onboardingHtml, toolbarHtml } from './template.js';

// Re-export config constants (localStorage keys only)
export { AUTO_RUN_KEY, ONBOARDING_SHOWN_KEY, STORAGE_KEY };

// Re-export for direct access
export { onboardingHtml, toolbarHtml, toolbarStyles };

// Re-export type and default config
export { DEFAULT_TOOLBAR_CONFIG };
export type { ToolbarConfig };

/**
 * Generate the toolbar JavaScript code
 * @param config - Toolbar configuration from config.yaml
 */
export function getToolbarScript(config: ToolbarConfig = DEFAULT_TOOLBAR_CONFIG): string {
  const {
    font_size_min,
    font_size_max,
    font_size_default_mobile,
    font_size_default_pc,
    double_tap_delay
  } = config;

  return `(function() {
  const container = document.getElementById('ttyd-toolbar');
  const input = document.getElementById('ttyd-toolbar-input');
  const sendBtn = document.getElementById('ttyd-toolbar-send');
  const enterBtn = document.getElementById('ttyd-toolbar-enter');
  const zoomInBtn = document.getElementById('ttyd-toolbar-zoomin');
  const zoomOutBtn = document.getElementById('ttyd-toolbar-zoomout');
  const runBtn = document.getElementById('ttyd-toolbar-run');
  const toggleBtn = document.getElementById('ttyd-toolbar-toggle');
  const ctrlBtn = document.getElementById('ttyd-toolbar-ctrl');
  const altBtn = document.getElementById('ttyd-toolbar-alt');
  const shiftBtn = document.getElementById('ttyd-toolbar-shift');
  const escBtn = document.getElementById('ttyd-toolbar-esc');
  const tabBtn = document.getElementById('ttyd-toolbar-tab');
  const upBtn = document.getElementById('ttyd-toolbar-up');
  const downBtn = document.getElementById('ttyd-toolbar-down');
  const copyBtn = document.getElementById('ttyd-toolbar-copy');
  const copyAllBtn = document.getElementById('ttyd-toolbar-copyall');
  const autoBtn = document.getElementById('ttyd-toolbar-auto');
  const minimizeBtn = document.getElementById('ttyd-toolbar-minimize');
  const scrollBtn = document.getElementById('ttyd-toolbar-scroll');
  const pageUpBtn = document.getElementById('ttyd-toolbar-pageup');
  const pageDownBtn = document.getElementById('ttyd-toolbar-pagedown');

  let ws = null;
  let ctrlActive = false;
  let altActive = false;
  let shiftActive = false;
  let autoRunActive = false;
  let scrollActive = false;

  // Detect mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Font size configuration (from config.yaml)
  const FONT_SIZE_MIN = ${font_size_min};
  const FONT_SIZE_MAX = ${font_size_max};
  const FONT_SIZE_DEFAULT = isMobile ? ${font_size_default_mobile} : ${font_size_default_pc};
  const FONT_SIZE_STORAGE_KEY = '${STORAGE_KEY}';
  const ONBOARDING_KEY = '${ONBOARDING_SHOWN_KEY}';
  const AUTO_RUN_STORAGE_KEY = '${AUTO_RUN_KEY}';

  function saveFontSize(size) {
    try {
      localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(size));
    } catch (e) {
      console.warn('[Toolbar] Failed to save font size:', e);
    }
  }

  function loadFontSize() {
    try {
      const saved = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
      if (saved) {
        const size = parseInt(saved, 10);
        if (!isNaN(size) && size >= FONT_SIZE_MIN && size <= FONT_SIZE_MAX) {
          return size;
        }
      }
    } catch (e) {
      console.warn('[Toolbar] Failed to load font size:', e);
    }
    return FONT_SIZE_DEFAULT;
  }

  function saveAutoRun(enabled) {
    try {
      localStorage.setItem(AUTO_RUN_STORAGE_KEY, enabled ? '1' : '0');
    } catch (e) {
      console.warn('[Toolbar] Failed to save auto-run state:', e);
    }
  }

  function loadAutoRun() {
    try {
      const saved = localStorage.getItem(AUTO_RUN_STORAGE_KEY);
      return saved === '1';
    } catch (e) {
      console.warn('[Toolbar] Failed to load auto-run state:', e);
    }
    return false;
  }

  // Find the WebSocket connection
  function findWebSocket() {
    if (ws && ws.readyState === WebSocket.OPEN) return ws;

    if (window.socket && window.socket.readyState === WebSocket.OPEN) {
      ws = window.socket;
      return ws;
    }

    return null;
  }

  // Intercept WebSocket creation to capture the connection
  const OriginalWebSocket = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    const socket = new OriginalWebSocket(url, protocols);
    if (url.includes('/ws')) {
      ws = socket;
    }
    return socket;
  };
  window.WebSocket.prototype = OriginalWebSocket.prototype;
  window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
  window.WebSocket.OPEN = OriginalWebSocket.OPEN;
  window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
  window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;

  function sendText(text) {
    const socket = findWebSocket();
    if (!socket) {
      console.error('[Toolbar] WebSocket not found');
      return false;
    }

    // ttyd protocol: binary data with '0' (input command) as first byte
    const encoder = new TextEncoder();
    const textBytes = encoder.encode(text);
    const data = new Uint8Array(textBytes.length + 1);
    data[0] = '0'.charCodeAt(0);  // Input command
    data.set(textBytes, 1);
    socket.send(data);
    return true;
  }

  function sendKey(key) {
    // Apply modifiers
    if (ctrlActive && key.length === 1) {
      // Ctrl+key: send as control character (A=1, B=2, ..., Z=26)
      const code = key.toUpperCase().charCodeAt(0) - 64;
      if (code > 0 && code < 32) {
        sendBytes([code]);
      }
      resetModifiers();
    } else if (altActive && key.length === 1) {
      // Alt+key: send ESC + key
      const keyCode = key.charCodeAt(0);
      sendBytes([0x1B, keyCode]);
      resetModifiers();
    } else {
      sendText(key);
    }
  }

  function resetModifiers() {
    ctrlActive = false;
    altActive = false;
    ctrlBtn.classList.remove('active');
    altBtn.classList.remove('active');
  }

  // Send raw bytes for special keys
  function sendBytes(bytes) {
    const socket = findWebSocket();
    if (!socket) {
      console.error('[Toolbar] WebSocket not found');
      return false;
    }
    const data = new Uint8Array(bytes.length + 1);
    data[0] = 0x30;  // '0' = input command
    data.set(bytes, 1);
    socket.send(data);
    return true;
  }

  function sendEnter() {
    sendBytes([0x0D]);  // CR
  }

  function sendEsc() {
    sendBytes([0x1B]);  // ESC
  }

  function sendTab() {
    sendBytes([0x09]);  // TAB
  }

  function sendUp() {
    sendBytes([0x1B, 0x5B, 0x41]);  // ESC [ A
  }

  function sendDown() {
    sendBytes([0x1B, 0x5B, 0x42]);  // ESC [ B
  }

  function sendPageUp() {
    sendBytes([0x1B, 0x5B, 0x35, 0x7E]);  // ESC [ 5 ~
  }

  function sendPageDown() {
    sendBytes([0x1B, 0x5B, 0x36, 0x7E]);  // ESC [ 6 ~
  }

  function fitTerminal() {
    if (window.fitAddon && typeof window.fitAddon.fit === 'function') {
      window.fitAddon.fit();
      console.log('[Toolbar] Terminal fitted via fitAddon');
      return;
    }

    if (window.term && window.term.fitAddon && typeof window.term.fitAddon.fit === 'function') {
      window.term.fitAddon.fit();
      console.log('[Toolbar] Terminal fitted via term.fitAddon');
      return;
    }

    window.dispatchEvent(new Event('resize'));
    console.log('[Toolbar] Dispatched resize event');
  }

  function findTerminal() {
    if (window.term) return window.term;
    const termEl = document.querySelector('.xterm');
    if (termEl && termEl._core) return termEl._core;
    return null;
  }

  function zoomTerminal(delta) {
    const term = findTerminal();

    if (term && term.options) {
      const currentSize = term.options.fontSize || FONT_SIZE_DEFAULT;
      const newSize = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, currentSize + delta));
      term.options.fontSize = newSize;
      saveFontSize(newSize);
      console.log('[Toolbar] Font size changed to ' + newSize);
      fitTerminal();
    } else {
      console.log('[Toolbar] Terminal not found for zoom');
    }
  }

  function copySelection() {
    const term = findTerminal();
    if (!term) {
      console.log('[Toolbar] Terminal not found for copy');
      return;
    }
    const selection = term.getSelection();
    if (selection) {
      navigator.clipboard.writeText(selection).then(function() {
        console.log('[Toolbar] Copied selection to clipboard');
      }).catch(function(err) {
        console.error('[Toolbar] Failed to copy:', err);
      });
    } else {
      console.log('[Toolbar] No text selected');
    }
  }

  function copyAll() {
    const term = findTerminal();
    if (!term || !term.buffer || !term.buffer.active) {
      console.log('[Toolbar] Terminal buffer not found');
      return;
    }
    const buffer = term.buffer.active;
    const lines = [];
    for (let i = 0; i < buffer.length; i++) {
      const line = buffer.getLine(i);
      if (line) {
        lines.push(line.translateToString(true));
      }
    }
    const text = lines.join('\\n').trimEnd();
    navigator.clipboard.writeText(text).then(function() {
      console.log('[Toolbar] Copied all text to clipboard');
    }).catch(function(err) {
      console.error('[Toolbar] Failed to copy:', err);
    });
  }

  function submitInput() {
    const text = input.value;
    if (!text) return;

    if (sendText(text)) {
      input.value = '';
      adjustTextareaHeight();
      // Auto mode: send Enter after 1 second
      if (autoRunActive) {
        setTimeout(function() {
          sendEnter();
        }, 1000);
      }
    }
  }

  function runInput() {
    const text = input.value;
    if (!text) return;

    if (sendText(text)) {
      input.value = '';
      adjustTextareaHeight();
      // Wait 1 second then send Enter
      setTimeout(function() {
        sendEnter();
      }, 1000);
    }
  }

  function toggleToolbar(show) {
    if (typeof show === 'boolean') {
      container.classList.toggle('hidden', !show);
    } else {
      container.classList.toggle('hidden');
    }

    if (!container.classList.contains('hidden')) {
      input.focus();
      // Fit terminal after showing toolbar
      setTimeout(fitTerminal, 100);
    } else {
      const terminal = document.querySelector('.xterm-helper-textarea');
      if (terminal) terminal.focus();
      setTimeout(fitTerminal, 100);
    }
  }

  function adjustTextareaHeight() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  }

  // Event listeners
  sendBtn.addEventListener('click', function(e) {
    e.preventDefault();
    submitInput();
  });

  enterBtn.addEventListener('click', function(e) {
    e.preventDefault();
    sendEnter();
  });

  runBtn.addEventListener('click', function(e) {
    e.preventDefault();
    runInput();
  });

  zoomInBtn.addEventListener('click', function(e) {
    e.preventDefault();
    zoomTerminal(2);
  });

  zoomOutBtn.addEventListener('click', function(e) {
    e.preventDefault();
    zoomTerminal(-2);
  });

  ctrlBtn.addEventListener('click', function(e) {
    e.preventDefault();
    ctrlActive = !ctrlActive;
    ctrlBtn.classList.toggle('active', ctrlActive);
    if (ctrlActive) {
      altActive = false;
      altBtn.classList.remove('active');
    }
  });

  altBtn.addEventListener('click', function(e) {
    e.preventDefault();
    altActive = !altActive;
    altBtn.classList.toggle('active', altActive);
    if (altActive) {
      ctrlActive = false;
      ctrlBtn.classList.remove('active');
    }
  });

  shiftBtn.addEventListener('click', function(e) {
    e.preventDefault();
    shiftActive = !shiftActive;
    shiftBtn.classList.toggle('active', shiftActive);
  });

  autoBtn.addEventListener('click', function(e) {
    e.preventDefault();
    autoRunActive = !autoRunActive;
    autoBtn.classList.toggle('active', autoRunActive);
    saveAutoRun(autoRunActive);
  });

  escBtn.addEventListener('click', function(e) {
    e.preventDefault();
    sendEsc();
  });

  tabBtn.addEventListener('click', function(e) {
    e.preventDefault();
    sendTab();
  });

  upBtn.addEventListener('click', function(e) {
    e.preventDefault();
    sendUp();
  });

  downBtn.addEventListener('click', function(e) {
    e.preventDefault();
    sendDown();
  });

  pageUpBtn.addEventListener('click', function(e) {
    e.preventDefault();
    sendPageUp();
  });

  pageDownBtn.addEventListener('click', function(e) {
    e.preventDefault();
    sendPageDown();
  });

  scrollBtn.addEventListener('click', function(e) {
    e.preventDefault();
    scrollActive = !scrollActive;
    scrollBtn.classList.toggle('active', scrollActive);
    if (scrollActive) {
      console.log('[Toolbar] Scroll mode enabled - drag to scroll');
    } else {
      console.log('[Toolbar] Scroll mode disabled');
    }
  });

  copyBtn.addEventListener('click', function(e) {
    e.preventDefault();
    copySelection();
  });

  copyAllBtn.addEventListener('click', function(e) {
    e.preventDefault();
    copyAll();
  });

  minimizeBtn.addEventListener('click', function(e) {
    e.preventDefault();
    container.classList.toggle('minimized');
    // Update button text based on state
    minimizeBtn.textContent = container.classList.contains('minimized') ? '▲' : '▼';
    setTimeout(fitTerminal, 100);
  });

  input.addEventListener('input', adjustTextareaHeight);

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      submitInput();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      toggleToolbar(false);
    }
  });

  toggleBtn.addEventListener('click', function(e) {
    e.preventDefault();
    toggleToolbar();
  });

  // Keyboard shortcut: Ctrl+J to toggle toolbar
  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'j') {
      e.preventDefault();
      toggleToolbar();
    }
  });

  // Inject shiftKey into mouse events when Shift button is active
  // This allows text selection to bypass tmux mouse mode
  ['mousedown', 'mousemove', 'mouseup'].forEach(function(eventType) {
    document.addEventListener(eventType, function(e) {
      // Don't interfere with toolbar buttons
      if (e.target.closest('#ttyd-toolbar') || e.target.closest('#ttyd-toolbar-toggle')) {
        return;
      }
      if (shiftActive && !e.shiftKey) {
        const newEvent = new MouseEvent(e.type, {
          bubbles: e.bubbles,
          cancelable: e.cancelable,
          view: e.view,
          detail: e.detail,
          screenX: e.screenX,
          screenY: e.screenY,
          clientX: e.clientX,
          clientY: e.clientY,
          ctrlKey: e.ctrlKey,
          altKey: e.altKey,
          shiftKey: true,
          metaKey: e.metaKey,
          button: e.button,
          buttons: e.buttons,
          relatedTarget: e.relatedTarget
        });
        e.stopImmediatePropagation();
        e.preventDefault();
        e.target.dispatchEvent(newEvent);
      }
    }, true);
  });

  // Convert touch events to mouse events with shiftKey when Shift is active
  // This enables text selection on mobile devices
  let touchStartPos = null;

  function dispatchMouseEvent(type, touch, shiftKey) {
    const mouseEvent = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      view: window,
      detail: 1,
      screenX: touch.screenX,
      screenY: touch.screenY,
      clientX: touch.clientX,
      clientY: touch.clientY,
      ctrlKey: false,
      altKey: false,
      shiftKey: shiftKey,
      metaKey: false,
      button: 0,
      buttons: type === 'mouseup' ? 0 : 1,
      relatedTarget: null
    });
    touch.target.dispatchEvent(mouseEvent);
  }

  let shiftTouchActive = false;  // Track if we're in Shift+touch selection mode
  let scrollTouchActive = false;  // Track if we're in scroll drag mode
  let scrollLastY = 0;  // Track last Y position for scroll delta
  const SCROLL_THRESHOLD = 30;  // Pixels to drag before triggering scroll

  document.addEventListener('touchstart', function(e) {
    // Don't interfere with toolbar buttons
    if (e.target.closest('#ttyd-toolbar') || e.target.closest('#ttyd-toolbar-toggle')) {
      return;
    }
    // Single finger touch with Scroll active -> enable scroll drag mode
    if (e.touches.length === 1 && scrollActive) {
      const touch = e.touches[0];
      touchStartPos = { x: touch.clientX, y: touch.clientY };
      scrollLastY = touch.clientY;
      scrollTouchActive = true;
      e.preventDefault();
    }
    // Single finger touch with Shift active -> convert to mouse event for selection
    else if (e.touches.length === 1 && shiftActive) {
      const touch = e.touches[0];
      touchStartPos = { x: touch.clientX, y: touch.clientY };
      shiftTouchActive = true;
      e.preventDefault();
      dispatchMouseEvent('mousedown', touch, true);
    }
    // 2nd finger added -> cancel Shift/Scroll mode, allow pinch
    else if (e.touches.length === 2 && (shiftTouchActive || scrollTouchActive)) {
      if (shiftTouchActive) {
        dispatchMouseEvent('mouseup', e.touches[0], true);
      }
      shiftTouchActive = false;
      scrollTouchActive = false;
      touchStartPos = null;
      // Don't preventDefault - let pinch handlers take over
    }
    // Track non-Shift/Scroll single touch for hint
    else if (e.touches.length === 1 && !shiftActive && !scrollActive) {
      const touch = e.touches[0];
      touchStartPos = { x: touch.clientX, y: touch.clientY };
    }
  }, { passive: false, capture: true });

  document.addEventListener('touchmove', function(e) {
    // Handle scroll drag mode
    if (e.touches.length === 1 && scrollTouchActive) {
      e.preventDefault();
      const touch = e.touches[0];
      const deltaY = scrollLastY - touch.clientY;  // Positive = dragging up (scroll down/page down)

      // Trigger scroll when threshold is reached
      if (Math.abs(deltaY) >= SCROLL_THRESHOLD) {
        if (deltaY > 0) {
          sendPageDown();
        } else {
          sendPageUp();
        }
        scrollLastY = touch.clientY;  // Reset for next scroll step
      }
    }
    // Handle Shift selection mode
    else if (e.touches.length === 1 && shiftTouchActive) {
      e.preventDefault();
      dispatchMouseEvent('mousemove', e.touches[0], true);
    }
    // Don't interfere with 2-finger gestures (pinch)
  }, { passive: false, capture: true });

  document.addEventListener('touchend', function(e) {
    // Scroll mode ending
    if (scrollTouchActive && e.touches.length === 0) {
      scrollTouchActive = false;
      touchStartPos = null;
    }
    // Shift selection mode ending
    else if (shiftTouchActive && e.touches.length === 0) {
      const touch = e.changedTouches[0];
      dispatchMouseEvent('mouseup', touch, true);
      shiftTouchActive = false;
      touchStartPos = null;
    }
  }, { passive: true, capture: true });

  // Pinch-to-zoom for font size (when Ctrl or Shift is active)
  let pinchStartDistance = 0;
  let pinchStartFontSize = FONT_SIZE_DEFAULT;

  function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  document.addEventListener('touchstart', function(e) {
    if (e.touches.length === 2 && (ctrlActive || shiftActive)) {
      pinchStartDistance = getTouchDistance(e.touches);
      const term = findTerminal();
      pinchStartFontSize = (term && term.options) ? (term.options.fontSize || FONT_SIZE_DEFAULT) : FONT_SIZE_DEFAULT;
    }
  }, { passive: true });

  document.addEventListener('touchmove', function(e) {
    if (e.touches.length === 2 && (ctrlActive || shiftActive) && pinchStartDistance > 0) {
      e.preventDefault();  // Suppress browser zoom
      const currentDistance = getTouchDistance(e.touches);
      const scale = currentDistance / pinchStartDistance;
      const newSize = Math.round(pinchStartFontSize * scale);
      const clampedSize = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, newSize));

      const term = findTerminal();
      if (term && term.options && term.options.fontSize !== clampedSize) {
        term.options.fontSize = clampedSize;
        saveFontSize(clampedSize);
        fitTerminal();
      }
    }
  }, { passive: false });

  document.addEventListener('touchend', function(e) {
    if (e.touches.length < 2) {
      pinchStartDistance = 0;
    }
  }, { passive: true });

  // ========== PC: Ctrl+Wheel / Trackpad Pinch ==========
  document.addEventListener('wheel', function(e) {
    // ctrlKey = trackpad pinch (Mac) or Ctrl+scroll (PC)
    if (e.ctrlKey) {
      e.preventDefault();  // Suppress browser zoom

      // deltaY > 0: zoom out, deltaY < 0: zoom in
      const delta = e.deltaY > 0 ? -2 : 2;
      zoomTerminal(delta);
    }
  }, { passive: false });

  // Double-tap to send Enter (for reconnecting)
  let lastTapTime = 0;
  const DOUBLE_TAP_DELAY = ${double_tap_delay};

  document.addEventListener('touchend', function(e) {
    // Exclude toolbar elements
    if (e.target.closest('#ttyd-toolbar') || e.target.closest('#ttyd-toolbar-toggle')) {
      return;
    }
    // Single touch only
    if (e.changedTouches.length !== 1) return;

    const now = Date.now();
    if (now - lastTapTime < DOUBLE_TAP_DELAY) {
      // Double tap detected -> send Enter
      sendEnter();
      lastTapTime = 0;  // Reset
    } else {
      lastTapTime = now;
    }
  }, { passive: true });

  // Auto-show on mobile devices
  if (isMobile) {
    setTimeout(function() {
      toggleToolbar(true);
    }, 1000);
  }

  // Onboarding: show tips on first access (mobile only)
  function showOnboarding() {
    const onboarding = document.getElementById('ttyd-toolbar-onboarding');
    if (!onboarding) return;

    try {
      if (localStorage.getItem(ONBOARDING_KEY)) {
        onboarding.remove();
        return;
      }
    } catch (e) {
      // localStorage not available
    }

    // Show onboarding tooltip
    onboarding.style.display = 'block';

    const closeBtn = document.getElementById('ttyd-toolbar-onboarding-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        onboarding.remove();
        try {
          localStorage.setItem(ONBOARDING_KEY, '1');
        } catch (e) {
          // Ignore
        }
      });
    }

    // Auto-dismiss after 15 seconds
    setTimeout(function() {
      if (onboarding.parentNode) {
        onboarding.remove();
        try {
          localStorage.setItem(ONBOARDING_KEY, '1');
        } catch (e) {
          // Ignore
        }
      }
    }, 15000);
  }

  if (isMobile) {
    setTimeout(showOnboarding, 1500);
  }

  // Restore font size from localStorage
  function applyStoredFontSize() {
    const term = findTerminal();
    if (term && term.options) {
      const storedSize = loadFontSize();
      term.options.fontSize = storedSize;
      fitTerminal();
      console.log('[Toolbar] Restored font size: ' + storedSize);
    }
  }

  // Try to apply stored font size after terminal is ready
  setTimeout(applyStoredFontSize, 500);
  setTimeout(applyStoredFontSize, 1500);

  // Restore auto-run state from localStorage
  function applyStoredAutoRun() {
    const storedAutoRun = loadAutoRun();
    if (storedAutoRun) {
      autoRunActive = true;
      autoBtn.classList.add('active');
      console.log('[Toolbar] Restored auto-run mode: enabled');
    }
  }
  applyStoredAutoRun();

  // Auto-reload when tab becomes visible if WebSocket is disconnected
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
      const socket = findWebSocket();
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.log('[Toolbar] Connection lost, reloading...');
        location.reload();
      }
    }
  });

  console.log('[Toolbar] Loaded. ' + (isMobile ? 'Mobile mode.' : 'Press Ctrl+J or click keyboard button to toggle.'));
})();`;
}

/**
 * Get the complete toolbar JavaScript for serving as external file
 * @param config - Toolbar configuration from config.yaml
 */
export function getToolbarJs(config: ToolbarConfig = DEFAULT_TOOLBAR_CONFIG): string {
  return getToolbarScript(config);
}

/**
 * Inject toolbar into HTML response
 *
 * Injects:
 * - CSS styles (inline for FOUC avoidance)
 * - HTML structure
 * - Onboarding tooltip (hidden by default)
 * - Script tag referencing external toolbar.js
 *
 * @param html - Original HTML content
 * @param basePath - Base path for the ttyd-mux routes (e.g., "/ttyd-mux")
 * @returns Modified HTML with toolbar injected
 */
export function injectToolbar(html: string, basePath: string): string {
  const injection = `
<style>${toolbarStyles}</style>
${toolbarHtml}
${onboardingHtml.replace('id="ttyd-toolbar-onboarding"', 'id="ttyd-toolbar-onboarding" style="display:none"')}
<script src="${basePath}/toolbar.js"></script>
`;
  return html.replace('</body>', `${injection}</body>`);
}
