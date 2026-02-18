/**
 * Terminal Toolbar HTML Template
 */

export const toolbarHtml = `
<div id="ttyd-toolbar" class="hidden">
  <div id="ttyd-toolbar-buttons">
    <button id="ttyd-toolbar-ctrl" class="modifier">Ctrl</button>
    <button id="ttyd-toolbar-alt" class="modifier">Alt</button>
    <button id="ttyd-toolbar-shift" class="modifier">Shift</button>
    <button id="ttyd-toolbar-esc">Esc</button>
    <button id="ttyd-toolbar-tab">Tab</button>
    <button id="ttyd-toolbar-up">↑</button>
    <button id="ttyd-toolbar-down">↓</button>
    <button id="ttyd-toolbar-enter">Enter</button>
    <button id="ttyd-toolbar-zoomout">A-</button>
    <button id="ttyd-toolbar-zoomin">A+</button>
    <button id="ttyd-toolbar-copy">Copy</button>
    <button id="ttyd-toolbar-copyall">All</button>
    <button id="ttyd-toolbar-send">Send</button>
    <button id="ttyd-toolbar-run">Run</button>
    <button id="ttyd-toolbar-auto" class="modifier">Auto</button>
  </div>
  <div id="ttyd-toolbar-input-row">
    <textarea id="ttyd-toolbar-input" rows="1" placeholder="日本語入力 (Enter: 送信)"></textarea>
  </div>
</div>
<button id="ttyd-toolbar-toggle">⌨</button>
`;
