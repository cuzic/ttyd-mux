/**
 * Terminal Toolbar HTML Template
 */

export const toolbarHtml = `
<div id="ttyd-toolbar" class="hidden">
  <div id="ttyd-toolbar-buttons">
    <button id="ttyd-toolbar-ctrl" class="modifier">Ctrl</button>
    <button id="ttyd-toolbar-alt" class="modifier">Alt</button>
    <button id="ttyd-toolbar-shift" class="modifier">Shift</button>
    <button id="ttyd-toolbar-scroll" class="modifier">Scroll</button>
    <button id="ttyd-toolbar-esc">Esc</button>
    <button id="ttyd-toolbar-tab">Tab</button>
    <button id="ttyd-toolbar-up">↑</button>
    <button id="ttyd-toolbar-down">↓</button>
    <button id="ttyd-toolbar-pageup">PgUp</button>
    <button id="ttyd-toolbar-pagedown">PgDn</button>
    <button id="ttyd-toolbar-enter">Enter</button>
    <button id="ttyd-toolbar-zoomout">A-</button>
    <button id="ttyd-toolbar-zoomin">A+</button>
    <button id="ttyd-toolbar-copy">Copy</button>
    <button id="ttyd-toolbar-copyall">All</button>
    <button id="ttyd-toolbar-search">🔍</button>
    <button id="ttyd-toolbar-notify" title="Push通知">🔔</button>
    <button id="ttyd-toolbar-share" title="共有リンク">🔗</button>
    <button id="ttyd-toolbar-send">Send</button>
    <button id="ttyd-toolbar-run">Run</button>
    <button id="ttyd-toolbar-auto" class="modifier">Auto</button>
    <button id="ttyd-toolbar-minimize">▼</button>
  </div>
  <div id="ttyd-toolbar-input-row">
    <textarea id="ttyd-toolbar-input" rows="1" placeholder="日本語入力 (Enter: 送信)"></textarea>
  </div>
</div>
<div id="ttyd-search-bar" class="hidden">
  <input id="ttyd-search-input" type="text" placeholder="検索..." />
  <span id="ttyd-search-count">0/0</span>
  <button id="ttyd-search-prev" title="前へ (Shift+Enter)">◀</button>
  <button id="ttyd-search-next" title="次へ (Enter)">▶</button>
  <button id="ttyd-search-case" class="modifier" title="大文字小文字を区別">Aa</button>
  <button id="ttyd-search-regex" class="modifier" title="正規表現">.*</button>
  <button id="ttyd-search-close" title="閉じる (Esc)">✕</button>
</div>
<button id="ttyd-toolbar-toggle">⌨</button>
<div id="ttyd-share-modal" class="hidden">
  <div id="ttyd-share-modal-content">
    <div id="ttyd-share-modal-header">
      <span>読み取り専用リンクを作成</span>
      <button id="ttyd-share-modal-close">×</button>
    </div>
    <div id="ttyd-share-modal-body">
      <div id="ttyd-share-expiry">
        <label>有効期限:</label>
        <div id="ttyd-share-expiry-options">
          <label><input type="radio" name="ttyd-share-expiry" value="1h"> 1時間</label>
          <label><input type="radio" name="ttyd-share-expiry" value="24h" checked> 24時間</label>
          <label><input type="radio" name="ttyd-share-expiry" value="7d"> 7日</label>
        </div>
      </div>
      <button id="ttyd-share-create">リンクを作成</button>
      <div id="ttyd-share-result" class="hidden">
        <input id="ttyd-share-url" type="text" readonly>
        <div id="ttyd-share-actions">
          <button id="ttyd-share-copy">コピー</button>
          <button id="ttyd-share-qr">QRコード</button>
        </div>
        <div id="ttyd-share-warning">
          ⚠ このリンクを知っている人は誰でもこの端末を閲覧できます
        </div>
      </div>
    </div>
  </div>
</div>
`;

export const onboardingHtml = `
<div id="ttyd-toolbar-onboarding">
  <button id="ttyd-toolbar-onboarding-close">×</button>
  <strong>Toolbar Tips</strong>
  <ul>
    <li><code>Ctrl+J</code> でツールバー表示/非表示</li>
    <li>ピンチ操作でフォントサイズ変更</li>
    <li>ダブルタップで Enter 送信</li>
    <li><code>▼</code> でコンパクト表示</li>
  </ul>
</div>
`;
