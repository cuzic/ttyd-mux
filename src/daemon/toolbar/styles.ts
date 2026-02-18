/**
 * Terminal Toolbar CSS Styles
 */

export const toolbarStyles = `
#ttyd-toolbar {
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

#ttyd-toolbar.hidden {
  display: none;
}

#ttyd-toolbar-buttons {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

#ttyd-toolbar-buttons button {
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

#ttyd-toolbar-buttons button:hover, #ttyd-toolbar-buttons button:active {
  background: #4a4a4a;
}

#ttyd-toolbar-buttons button.active {
  background: #007acc;
  border-color: #005a9e;
}

#ttyd-toolbar-buttons button.modifier {
  background: #2d2d2d;
  font-weight: bold;
}

#ttyd-toolbar-buttons button.modifier.active {
  background: #d9534f;
  border-color: #c9302c;
}

#ttyd-toolbar-send {
  background: #007acc !important;
  border-color: #005a9e !important;
  font-weight: bold;
}

#ttyd-toolbar-send:hover, #ttyd-toolbar-send:active {
  background: #005a9e !important;
}

#ttyd-toolbar-run {
  background: #28a745 !important;
  border-color: #1e7e34 !important;
  font-weight: bold;
}

#ttyd-toolbar-run:hover, #ttyd-toolbar-run:active {
  background: #1e7e34 !important;
}

#ttyd-toolbar-auto.active {
  background: #f0ad4e !important;
  border-color: #eea236 !important;
  color: #000;
}

#ttyd-toolbar-scroll.active {
  background: #17a2b8 !important;
  border-color: #138496 !important;
}

#ttyd-toolbar-input-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

#ttyd-toolbar-input {
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

#ttyd-toolbar-input:focus {
  border-color: #007acc;
}

#ttyd-toolbar-input::placeholder {
  color: #888;
}

#ttyd-toolbar-toggle {
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

#ttyd-toolbar-toggle:hover, #ttyd-toolbar-toggle:active {
  background: #005a9e;
  transform: scale(1.05);
}

#ttyd-toolbar.hidden ~ #ttyd-toolbar-toggle {
  bottom: 16px;
}

/* Adjust terminal height when toolbar is visible */
body:has(#ttyd-toolbar:not(.hidden)) .xterm {
  height: calc(100vh - 140px) !important;
}

/* Minimized mode - compact toolbar with input only */
#ttyd-toolbar.minimized #ttyd-toolbar-buttons {
  display: none;
}

#ttyd-toolbar.minimized {
  padding: 4px 8px;
}

#ttyd-toolbar-minimize {
  background: #555 !important;
  border-color: #666 !important;
  font-size: 10px;
  padding: 4px 8px;
  min-width: 32px;
  min-height: 32px;
}

/* Onboarding tooltip */
#ttyd-toolbar-onboarding {
  position: fixed;
  bottom: 90px;
  right: 16px;
  background: #333;
  border: 1px solid #007acc;
  border-radius: 8px;
  padding: 12px 16px;
  color: #fff;
  font-size: 13px;
  max-width: 280px;
  z-index: 10002;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  line-height: 1.5;
}

#ttyd-toolbar-onboarding::after {
  content: '';
  position: absolute;
  bottom: -8px;
  right: 24px;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 8px solid #333;
}

#ttyd-toolbar-onboarding-close {
  position: absolute;
  top: 4px;
  right: 8px;
  background: none;
  border: none;
  color: #888;
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
}

#ttyd-toolbar-onboarding-close:hover {
  color: #fff;
}

#ttyd-toolbar-onboarding ul {
  margin: 8px 0 0 0;
  padding-left: 20px;
}

#ttyd-toolbar-onboarding li {
  margin: 4px 0;
}

#ttyd-toolbar-onboarding code {
  background: #444;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}

/* Mobile optimizations */
@media (max-width: 768px) {
  #ttyd-toolbar {
    padding: 6px;
  }

  #ttyd-toolbar-buttons {
    gap: 4px;
    margin-bottom: 6px;
  }

  #ttyd-toolbar-buttons button {
    font-size: 12px;
    padding: 6px 10px;
    min-height: 36px;
    min-width: 40px;
  }

  #ttyd-toolbar-input {
    font-size: 16px;
    padding: 10px;
  }

  #ttyd-toolbar-toggle {
    width: 64px;
    height: 64px;
    font-size: 24px;
  }

  body:has(#ttyd-toolbar:not(.hidden)) .xterm {
    height: calc(100vh - 130px) !important;
  }

  body:has(#ttyd-toolbar.minimized:not(.hidden)) .xterm {
    height: calc(100vh - 60px) !important;
  }

  #ttyd-toolbar-onboarding {
    left: 16px;
    right: 16px;
    max-width: none;
  }
}
`;
