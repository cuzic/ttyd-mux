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

  #ttyd-search-bar {
    padding: 6px;
  }

  #ttyd-search-input {
    font-size: 14px;
    padding: 8px 10px;
  }
}

/* Search bar styles */
#ttyd-search-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: #1e1e1e;
  border-bottom: 2px solid #007acc;
  padding: 8px 12px;
  z-index: 10000;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  box-shadow: 0 2px 10px rgba(0,0,0,0.3);
  display: flex;
  gap: 8px;
  align-items: center;
}

#ttyd-search-bar.hidden {
  display: none;
}

#ttyd-search-input {
  flex: 1;
  background: #2d2d2d;
  border: 1px solid #555;
  border-radius: 6px;
  color: #fff;
  font-family: monospace;
  font-size: 14px;
  padding: 8px 12px;
  outline: none;
  min-width: 100px;
}

#ttyd-search-input:focus {
  border-color: #007acc;
}

#ttyd-search-input::placeholder {
  color: #888;
}

#ttyd-search-count {
  color: #888;
  font-size: 12px;
  white-space: nowrap;
  min-width: 50px;
  text-align: center;
}

#ttyd-search-bar button {
  background: #3a3a3a;
  border: 1px solid #555;
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  padding: 6px 10px;
  min-height: 32px;
  min-width: 32px;
  touch-action: manipulation;
}

#ttyd-search-bar button:hover,
#ttyd-search-bar button:active {
  background: #4a4a4a;
}

#ttyd-search-bar button.modifier {
  background: #2d2d2d;
  font-weight: bold;
}

#ttyd-search-bar button.modifier.active {
  background: #007acc;
  border-color: #005a9e;
}

#ttyd-search-close {
  color: #888;
}

#ttyd-search-close:hover {
  color: #fff;
}

/* Visual bell effect */
.xterm.bell-flash {
  animation: bell-flash 100ms ease-out;
}

@keyframes bell-flash {
  0% { filter: brightness(1); }
  50% { filter: brightness(1.5); }
  100% { filter: brightness(1); }
}

/* Share modal styles */
#ttyd-share-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.7);
  z-index: 10010;
  display: flex;
  align-items: center;
  justify-content: center;
}

#ttyd-share-modal.hidden {
  display: none;
}

#ttyd-share-modal-content {
  background: #2d2d2d;
  border-radius: 12px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
}

#ttyd-share-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #444;
  font-size: 16px;
  font-weight: bold;
}

#ttyd-share-modal-close {
  background: none;
  border: none;
  color: #888;
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
  line-height: 1;
}

#ttyd-share-modal-close:hover {
  color: #fff;
}

#ttyd-share-modal-body {
  padding: 16px;
}

#ttyd-share-expiry {
  margin-bottom: 16px;
}

#ttyd-share-expiry > label {
  display: block;
  margin-bottom: 8px;
  color: #aaa;
  font-size: 14px;
}

#ttyd-share-expiry-options {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

#ttyd-share-expiry-options label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 14px;
}

#ttyd-share-expiry-options input[type="radio"] {
  accent-color: #007acc;
}

#ttyd-share-create {
  width: 100%;
  background: #007acc;
  border: none;
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
  font-size: 15px;
  font-weight: bold;
  padding: 12px 16px;
  transition: background 0.2s;
}

#ttyd-share-create:hover {
  background: #005a9e;
}

#ttyd-share-create:disabled {
  background: #555;
  cursor: not-allowed;
}

#ttyd-share-create.hidden {
  display: none;
}

#ttyd-share-result {
  margin-top: 16px;
}

#ttyd-share-result.hidden {
  display: none;
}

#ttyd-share-url {
  width: 100%;
  background: #1e1e1e;
  border: 1px solid #555;
  border-radius: 6px;
  color: #fff;
  font-family: monospace;
  font-size: 13px;
  padding: 10px;
  margin-bottom: 12px;
  box-sizing: border-box;
}

#ttyd-share-url:focus {
  outline: none;
  border-color: #007acc;
}

#ttyd-share-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

#ttyd-share-actions button {
  flex: 1;
  background: #3a3a3a;
  border: 1px solid #555;
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  padding: 10px 16px;
  transition: background 0.2s;
}

#ttyd-share-actions button:hover {
  background: #4a4a4a;
}

#ttyd-share-warning {
  background: rgba(255, 193, 7, 0.15);
  border: 1px solid rgba(255, 193, 7, 0.3);
  border-radius: 6px;
  color: #ffc107;
  font-size: 12px;
  padding: 10px;
  text-align: center;
}

/* Mobile adjustments for share modal */
@media (max-width: 768px) {
  #ttyd-share-modal-content {
    max-width: none;
    width: calc(100% - 32px);
    margin: 16px;
  }

  #ttyd-share-expiry-options {
    flex-direction: column;
    gap: 10px;
  }
}

/* Snippet modal styles */
#ttyd-snippet-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.7);
  z-index: 10010;
  display: flex;
  align-items: center;
  justify-content: center;
}

#ttyd-snippet-modal.hidden {
  display: none;
}

#ttyd-snippet-modal-content {
  background: #2d2d2d;
  border-radius: 12px;
  max-width: 450px;
  width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
}

#ttyd-snippet-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #444;
  font-size: 16px;
  font-weight: bold;
}

#ttyd-snippet-modal-actions {
  display: flex;
  gap: 8px;
}

#ttyd-snippet-modal-actions button {
  background: none;
  border: none;
  color: #888;
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
  line-height: 1;
  border-radius: 4px;
}

#ttyd-snippet-modal-actions button:hover {
  color: #fff;
  background: #444;
}

#ttyd-snippet-add {
  color: #007acc !important;
  font-weight: bold;
}

#ttyd-snippet-add:hover {
  color: #fff !important;
}

#ttyd-snippet-modal-body {
  padding: 16px;
  overflow-y: auto;
  flex: 1;
}

#ttyd-snippet-search {
  width: 100%;
  background: #1e1e1e;
  border: 1px solid #555;
  border-radius: 6px;
  color: #fff;
  font-size: 14px;
  padding: 10px;
  margin-bottom: 12px;
  box-sizing: border-box;
}

#ttyd-snippet-search:focus {
  outline: none;
  border-color: #007acc;
}

#ttyd-snippet-search::placeholder {
  color: #888;
}

#ttyd-snippet-add-form {
  background: #1e1e1e;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
}

#ttyd-snippet-add-form.hidden {
  display: none;
}

#ttyd-snippet-add-name {
  width: 100%;
  background: #2d2d2d;
  border: 1px solid #555;
  border-radius: 6px;
  color: #fff;
  font-size: 14px;
  padding: 10px;
  margin-bottom: 8px;
  box-sizing: border-box;
}

#ttyd-snippet-add-name:focus {
  outline: none;
  border-color: #007acc;
}

#ttyd-snippet-add-command {
  width: 100%;
  background: #2d2d2d;
  border: 1px solid #555;
  border-radius: 6px;
  color: #fff;
  font-family: monospace;
  font-size: 14px;
  padding: 10px;
  margin-bottom: 8px;
  box-sizing: border-box;
  resize: vertical;
  min-height: 60px;
}

#ttyd-snippet-add-command:focus {
  outline: none;
  border-color: #007acc;
}

#ttyd-snippet-add-buttons {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

#ttyd-snippet-add-buttons button {
  background: #3a3a3a;
  border: 1px solid #555;
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  padding: 8px 16px;
}

#ttyd-snippet-add-buttons button:hover {
  background: #4a4a4a;
}

#ttyd-snippet-add-save {
  background: #007acc !important;
  border-color: #005a9e !important;
}

#ttyd-snippet-add-save:hover {
  background: #005a9e !important;
}

#ttyd-snippet-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

#ttyd-snippet-empty {
  text-align: center;
  color: #888;
  padding: 24px;
  font-size: 14px;
  line-height: 1.6;
}

#ttyd-snippet-empty.hidden {
  display: none;
}

.ttyd-snippet-item {
  background: #1e1e1e;
  border-radius: 8px;
  padding: 12px;
}

.ttyd-snippet-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.ttyd-snippet-item-name {
  font-weight: bold;
  font-size: 14px;
  color: #fff;
}

.ttyd-snippet-item-actions {
  display: flex;
  gap: 4px;
}

.ttyd-snippet-item-actions button {
  background: #3a3a3a;
  border: 1px solid #555;
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  padding: 6px 10px;
  min-width: 36px;
  min-height: 36px;
}

.ttyd-snippet-item-actions button:hover {
  background: #4a4a4a;
}

.ttyd-snippet-item-run {
  background: #28a745 !important;
  border-color: #1e7e34 !important;
}

.ttyd-snippet-item-run:hover {
  background: #1e7e34 !important;
}

.ttyd-snippet-item-delete {
  color: #888 !important;
}

.ttyd-snippet-item-delete:hover {
  color: #dc3545 !important;
  background: #3a3a3a !important;
}

.ttyd-snippet-item-edit {
  color: #888 !important;
}

.ttyd-snippet-item-edit:hover {
  color: #007acc !important;
  background: #3a3a3a !important;
}

.ttyd-snippet-item-command {
  font-family: monospace;
  font-size: 12px;
  color: #aaa;
  background: #252525;
  padding: 8px;
  border-radius: 4px;
  word-break: break-all;
  white-space: pre-wrap;
}

.ttyd-snippet-item-edit-form {
  margin-top: 8px;
}

.ttyd-snippet-item-edit-form input,
.ttyd-snippet-item-edit-form textarea {
  width: 100%;
  background: #2d2d2d;
  border: 1px solid #555;
  border-radius: 4px;
  color: #fff;
  font-size: 13px;
  padding: 8px;
  margin-bottom: 6px;
  box-sizing: border-box;
}

.ttyd-snippet-item-edit-form textarea {
  font-family: monospace;
  resize: vertical;
  min-height: 50px;
}

.ttyd-snippet-item-edit-form input:focus,
.ttyd-snippet-item-edit-form textarea:focus {
  outline: none;
  border-color: #007acc;
}

.ttyd-snippet-item-edit-buttons {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

.ttyd-snippet-item-edit-buttons button {
  background: #3a3a3a;
  border: 1px solid #555;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
  font-size: 12px;
  padding: 6px 12px;
}

.ttyd-snippet-item-edit-buttons button:hover {
  background: #4a4a4a;
}

.ttyd-snippet-item-edit-save {
  background: #007acc !important;
  border-color: #005a9e !important;
}

.ttyd-snippet-item-edit-save:hover {
  background: #005a9e !important;
}

.ttyd-snippet-item.editing .ttyd-snippet-item-command {
  display: none;
}

.ttyd-snippet-item:not(.editing) .ttyd-snippet-item-edit-form {
  display: none;
}

/* Mobile adjustments for snippet modal */
@media (max-width: 768px) {
  #ttyd-snippet-modal-content {
    max-width: none;
    width: calc(100% - 32px);
    margin: 16px;
    max-height: 70vh;
  }

  .ttyd-snippet-item-actions button {
    min-width: 44px;
    min-height: 44px;
  }
}

/* Clipboard history popup */
#ttyd-clipboard-history {
  position: fixed;
  background: #2d2d2d;
  border: 1px solid #555;
  border-radius: 8px;
  max-width: 300px;
  max-height: 250px;
  overflow-y: auto;
  z-index: 10020;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
}

#ttyd-clipboard-history.hidden {
  display: none;
}

#ttyd-clipboard-history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid #444;
  font-size: 13px;
  font-weight: bold;
  color: #fff;
}

#ttyd-clipboard-history-close {
  background: none;
  border: none;
  color: #888;
  font-size: 16px;
  cursor: pointer;
  padding: 2px 6px;
}

#ttyd-clipboard-history-close:hover {
  color: #fff;
}

#ttyd-clipboard-history-list {
  padding: 6px;
}

.ttyd-clipboard-history-item {
  background: #1e1e1e;
  border-radius: 4px;
  padding: 8px 10px;
  margin-bottom: 4px;
  cursor: pointer;
  font-family: monospace;
  font-size: 12px;
  color: #ccc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ttyd-clipboard-history-item:last-child {
  margin-bottom: 0;
}

.ttyd-clipboard-history-item:hover {
  background: #333;
  color: #fff;
}

#ttyd-clipboard-history-empty {
  padding: 16px;
  text-align: center;
  color: #888;
  font-size: 13px;
}

/* Mobile adjustments for clipboard history */
@media (max-width: 768px) {
  #ttyd-clipboard-history {
    max-width: calc(100vw - 32px);
    left: 16px !important;
    right: 16px !important;
  }
}
`;
