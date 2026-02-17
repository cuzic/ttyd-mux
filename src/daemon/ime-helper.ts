/**
 * IME Helper Script for ttyd
 * Provides a pseudo copy-paste input field for Japanese IME support
 * Optimized for mobile devices
 */

export const imeHelperScript = `
<style>
#ttyd-ime-container {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #1e1e1e;
  border-top: 2px solid #007acc;
  padding: 8px;
  z-index: 10000;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  box-shadow: 0 -2px 10px rgba(0,0,0,0.3);
}

#ttyd-ime-container.hidden {
  display: none;
}

#ttyd-ime-buttons {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

#ttyd-ime-buttons button {
  background: #3a3a3a;
  border: 1px solid #555;
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  padding: 8px 12px;
  min-height: 40px;
  min-width: 44px;
  touch-action: manipulation;
  flex-shrink: 0;
}

#ttyd-ime-buttons button:hover, #ttyd-ime-buttons button:active {
  background: #4a4a4a;
}

#ttyd-ime-buttons button.active {
  background: #007acc;
  border-color: #005a9e;
}

#ttyd-ime-buttons button.modifier {
  background: #2d2d2d;
  font-weight: bold;
}

#ttyd-ime-buttons button.modifier.active {
  background: #d9534f;
  border-color: #c9302c;
}

#ttyd-ime-send {
  background: #007acc !important;
  border-color: #005a9e !important;
  font-weight: bold;
}

#ttyd-ime-send:hover, #ttyd-ime-send:active {
  background: #005a9e !important;
}

#ttyd-ime-run {
  background: #28a745 !important;
  border-color: #1e7e34 !important;
  font-weight: bold;
}

#ttyd-ime-run:hover, #ttyd-ime-run:active {
  background: #1e7e34 !important;
}

#ttyd-ime-input-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

#ttyd-ime-input {
  flex: 1;
  background: #2d2d2d;
  border: 1px solid #555;
  border-radius: 8px;
  color: #fff;
  font-family: monospace;
  font-size: 16px;
  padding: 12px;
  outline: none;
  resize: none;
  min-height: 44px;
  max-height: 120px;
  line-height: 1.4;
}

#ttyd-ime-input:focus {
  border-color: #007acc;
}

#ttyd-ime-input::placeholder {
  color: #888;
}

#ttyd-ime-toggle {
  position: fixed;
  bottom: 16px;
  right: 16px;
  background: #007acc;
  border: 2px solid #005a9e;
  border-radius: 50%;
  color: #fff;
  cursor: pointer;
  font-size: 20px;
  width: 56px;
  height: 56px;
  z-index: 10001;
  touch-action: manipulation;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

#ttyd-ime-toggle:hover, #ttyd-ime-toggle:active {
  background: #005a9e;
  transform: scale(1.05);
}

#ttyd-ime-container.hidden ~ #ttyd-ime-toggle {
  bottom: 16px;
}

/* Adjust terminal height when IME bar is visible */
body:has(#ttyd-ime-container:not(.hidden)) .xterm {
  height: calc(100vh - 140px) !important;
}

/* Mobile optimizations */
@media (max-width: 768px) {
  #ttyd-ime-container {
    padding: 6px;
  }

  #ttyd-ime-buttons {
    gap: 4px;
    margin-bottom: 6px;
  }

  #ttyd-ime-buttons button {
    font-size: 12px;
    padding: 6px 10px;
    min-height: 36px;
    min-width: 40px;
  }

  #ttyd-ime-input {
    font-size: 16px;
    padding: 10px;
  }

  #ttyd-ime-toggle {
    width: 64px;
    height: 64px;
    font-size: 24px;
  }

  body:has(#ttyd-ime-container:not(.hidden)) .xterm {
    height: calc(100vh - 130px) !important;
  }
}
</style>

<div id="ttyd-ime-container" class="hidden">
  <div id="ttyd-ime-buttons">
    <button id="ttyd-ime-ctrl" class="modifier">Ctrl</button>
    <button id="ttyd-ime-alt" class="modifier">Alt</button>
    <button id="ttyd-ime-shift" class="modifier">Shift</button>
    <button id="ttyd-ime-esc">Esc</button>
    <button id="ttyd-ime-tab">Tab</button>
    <button id="ttyd-ime-up">↑</button>
    <button id="ttyd-ime-down">↓</button>
    <button id="ttyd-ime-enter">Enter</button>
    <button id="ttyd-ime-zoomout">A-</button>
    <button id="ttyd-ime-zoomin">A+</button>
    <button id="ttyd-ime-copy">Copy</button>
    <button id="ttyd-ime-copyall">All</button>
    <button id="ttyd-ime-send">Send</button>
    <button id="ttyd-ime-run">Run</button>
  </div>
  <div id="ttyd-ime-input-row">
    <textarea id="ttyd-ime-input" rows="1" placeholder="日本語入力 (Enter: 送信)"></textarea>
  </div>
</div>
<button id="ttyd-ime-toggle">⌨</button>

<script>
(function() {
  const container = document.getElementById('ttyd-ime-container');
  const input = document.getElementById('ttyd-ime-input');
  const sendBtn = document.getElementById('ttyd-ime-send');
  const enterBtn = document.getElementById('ttyd-ime-enter');
  const zoomInBtn = document.getElementById('ttyd-ime-zoomin');
  const zoomOutBtn = document.getElementById('ttyd-ime-zoomout');
  const runBtn = document.getElementById('ttyd-ime-run');
  const toggleBtn = document.getElementById('ttyd-ime-toggle');
  const ctrlBtn = document.getElementById('ttyd-ime-ctrl');
  const altBtn = document.getElementById('ttyd-ime-alt');
  const shiftBtn = document.getElementById('ttyd-ime-shift');
  const escBtn = document.getElementById('ttyd-ime-esc');
  const tabBtn = document.getElementById('ttyd-ime-tab');
  const upBtn = document.getElementById('ttyd-ime-up');
  const downBtn = document.getElementById('ttyd-ime-down');
  const copyBtn = document.getElementById('ttyd-ime-copy');
  const copyAllBtn = document.getElementById('ttyd-ime-copyall');

  let ws = null;
  let ctrlActive = false;
  let altActive = false;
  let shiftActive = false;

  // Detect mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

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
      console.error('[IME Helper] WebSocket not found');
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
      console.error('[IME Helper] WebSocket not found');
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

  function fitTerminal() {
    if (window.fitAddon && typeof window.fitAddon.fit === 'function') {
      window.fitAddon.fit();
      console.log('[IME Helper] Terminal fitted via fitAddon');
      return;
    }

    if (window.term && window.term.fitAddon && typeof window.term.fitAddon.fit === 'function') {
      window.term.fitAddon.fit();
      console.log('[IME Helper] Terminal fitted via term.fitAddon');
      return;
    }

    window.dispatchEvent(new Event('resize'));
    console.log('[IME Helper] Dispatched resize event');
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
      const currentSize = term.options.fontSize || 14;
      const newSize = Math.max(8, Math.min(32, currentSize + delta));
      term.options.fontSize = newSize;
      console.log('[IME Helper] Font size changed to ' + newSize);
      fitTerminal();
    } else {
      console.log('[IME Helper] Terminal not found for zoom');
    }
  }

  function copySelection() {
    const term = findTerminal();
    if (!term) {
      console.log('[IME Helper] Terminal not found for copy');
      return;
    }
    const selection = term.getSelection();
    if (selection) {
      navigator.clipboard.writeText(selection).then(function() {
        console.log('[IME Helper] Copied selection to clipboard');
      }).catch(function(err) {
        console.error('[IME Helper] Failed to copy:', err);
      });
    } else {
      console.log('[IME Helper] No text selected');
    }
  }

  function copyAll() {
    const term = findTerminal();
    if (!term || !term.buffer || !term.buffer.active) {
      console.log('[IME Helper] Terminal buffer not found');
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
      console.log('[IME Helper] Copied all text to clipboard');
    }).catch(function(err) {
      console.error('[IME Helper] Failed to copy:', err);
    });
  }

  function submitInput() {
    const text = input.value;
    if (!text) return;

    if (sendText(text)) {
      input.value = '';
      adjustTextareaHeight();
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

  function toggleIME(show) {
    if (typeof show === 'boolean') {
      container.classList.toggle('hidden', !show);
    } else {
      container.classList.toggle('hidden');
    }

    if (!container.classList.contains('hidden')) {
      input.focus();
      // Fit terminal after showing IME bar
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

  copyBtn.addEventListener('click', function(e) {
    e.preventDefault();
    copySelection();
  });

  copyAllBtn.addEventListener('click', function(e) {
    e.preventDefault();
    copyAll();
  });

  input.addEventListener('input', adjustTextareaHeight);

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      submitInput();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      toggleIME(false);
    }
  });

  toggleBtn.addEventListener('click', function(e) {
    e.preventDefault();
    toggleIME();
  });

  // Keyboard shortcut: Ctrl+J to toggle IME
  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'j') {
      e.preventDefault();
      toggleIME();
    }
  });

  // Inject shiftKey into mouse events when Shift button is active
  // This allows text selection to bypass tmux mouse mode
  ['mousedown', 'mousemove', 'mouseup'].forEach(function(eventType) {
    document.addEventListener(eventType, function(e) {
      // Don't interfere with IME helper buttons
      if (e.target.closest('#ttyd-ime-container') || e.target.closest('#ttyd-ime-toggle')) {
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

  // Track non-Shift drag operations and show hint after 3 consecutive drags
  let nonShiftDragCount = 0;
  let isDragging = false;
  let dragStartPos = null;

  document.addEventListener('mousedown', function(e) {
    if (e.button === 0 && !shiftActive && !e.shiftKey) {
      isDragging = true;
      dragStartPos = { x: e.clientX, y: e.clientY };
    }
  });

  document.addEventListener('mouseup', function(e) {
    if (isDragging && dragStartPos) {
      const dx = e.clientX - dragStartPos.x;
      const dy = e.clientY - dragStartPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Consider it a drag if moved more than 10 pixels
      if (distance > 10) {
        if (shiftActive || e.shiftKey) {
          nonShiftDragCount = 0;
        } else {
          nonShiftDragCount++;
          if (nonShiftDragCount >= 3) {
            alert('テキスト選択するには、Shift ボタンを ON にしてからドラッグしてください。\\n\\nTo select text, turn ON the Shift button and then drag.');
            nonShiftDragCount = 0;
          }
        }
      }
    }
    isDragging = false;
    dragStartPos = null;
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

  document.addEventListener('touchstart', function(e) {
    // Single finger touch with Shift active -> convert to mouse event for selection
    if (e.touches.length === 1 && shiftActive) {
      const touch = e.touches[0];
      touchStartPos = { x: touch.clientX, y: touch.clientY };
      shiftTouchActive = true;
      e.preventDefault();
      dispatchMouseEvent('mousedown', touch, true);
    }
    // 2nd finger added -> cancel Shift selection mode, allow pinch
    else if (e.touches.length === 2 && shiftTouchActive) {
      dispatchMouseEvent('mouseup', e.touches[0], true);
      shiftTouchActive = false;
      touchStartPos = null;
      // Don't preventDefault - let pinch handlers take over
    }
    // Track non-Shift single touch for hint
    else if (e.touches.length === 1 && !shiftActive) {
      const touch = e.touches[0];
      touchStartPos = { x: touch.clientX, y: touch.clientY };
    }
  }, { passive: false, capture: true });

  document.addEventListener('touchmove', function(e) {
    // Only handle single-finger moves when in Shift selection mode
    if (e.touches.length === 1 && shiftTouchActive) {
      e.preventDefault();
      dispatchMouseEvent('mousemove', e.touches[0], true);
    }
    // Don't interfere with 2-finger gestures (pinch)
  }, { passive: false, capture: true });

  document.addEventListener('touchend', function(e) {
    // Shift selection mode ending
    if (shiftTouchActive && e.touches.length === 0) {
      const touch = e.changedTouches[0];
      dispatchMouseEvent('mouseup', touch, true);
      shiftTouchActive = false;
      touchStartPos = null;
      nonShiftDragCount = 0;
    }
    // Non-Shift drag tracking
    else if (touchStartPos && !shiftTouchActive && e.touches.length === 0) {
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartPos.x;
      const dy = touch.clientY - touchStartPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 10) {
        nonShiftDragCount++;
        if (nonShiftDragCount >= 3) {
          alert('テキスト選択するには、Shift ボタンを ON にしてからドラッグしてください。\\n\\nTo select text, turn ON the Shift button and then drag.');
          nonShiftDragCount = 0;
        }
      }
      touchStartPos = null;
    }
  }, { passive: true, capture: true });

  // Pinch-to-zoom for font size (when Ctrl or Shift is active)
  let pinchStartDistance = 0;
  let pinchStartFontSize = 14;

  function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  document.addEventListener('touchstart', function(e) {
    if (e.touches.length === 2 && (ctrlActive || shiftActive)) {
      pinchStartDistance = getTouchDistance(e.touches);
      const term = findTerminal();
      pinchStartFontSize = (term && term.options) ? (term.options.fontSize || 14) : 14;
    }
  }, { passive: true });

  document.addEventListener('touchmove', function(e) {
    if (e.touches.length === 2 && (ctrlActive || shiftActive) && pinchStartDistance > 0) {
      e.preventDefault();  // Suppress browser zoom
      const currentDistance = getTouchDistance(e.touches);
      const scale = currentDistance / pinchStartDistance;
      const newSize = Math.round(pinchStartFontSize * scale);
      const clampedSize = Math.max(8, Math.min(32, newSize));

      const term = findTerminal();
      if (term && term.options && term.options.fontSize !== clampedSize) {
        term.options.fontSize = clampedSize;
        fitTerminal();
      }
    }
  }, { passive: false });

  document.addEventListener('touchend', function(e) {
    if (e.touches.length < 2) {
      pinchStartDistance = 0;
    }
  }, { passive: true });

  // Auto-show on mobile devices
  if (isMobile) {
    setTimeout(function() {
      toggleIME(true);
    }, 1000);
  }

  console.log('[IME Helper] Loaded. ' + (isMobile ? 'Mobile mode.' : 'Press Ctrl+J or click keyboard button to toggle.'));
})();
</script>
`;

export function injectImeHelper(html: string): string {
  // Inject before </body>
  return html.replace('</body>', imeHelperScript + '</body>');
}
