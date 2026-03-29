# ADR: Portal CSP Nonce and Inline Handler Removal

**Date**: 2026-03-29
**Status**: Accepted

## Context

ポータルページの tmux セッション一覧が表示されたりされなかったりする不具合があった。

### 根本原因

Elysia の `store.cspNonce` はアプリケーション全体で共有される状態。ターミナルページを開くと nonce がセットされ、その後ポータルページを開いても nonce が残ったまま。しかしポータルの `<script>` タグには nonce 属性がなく、CSP でスクリプト実行がブロックされていた。

さらに、ポータルの HTML には `onclick` 等のインラインイベントハンドラが多数あり、これも nonce ベースの CSP ではブロックされる（nonce はインライン属性には適用されない）。

## Decision

### 1. 全ページで nonce を生成・設定

ポータルページのルートハンドラでも `generateNonce()` を呼び、`store.cspNonce` をセットし、`generatePortalHtml()` に nonce を渡す。全 `<script>` タグに `nonce` 属性を付与。

### 2. インラインイベントハンドラの除去

全 `onclick` / `onchange` 属性を `data-*` 属性 + `addEventListener` によるイベントデリゲーションに置換。

```html
<!-- Before -->
<button onclick="connectToTmux('name')">Connect</button>

<!-- After -->
<button data-tmux-connect="name">Connect</button>
```

```javascript
document.addEventListener('click', function(e) {
  var btn = e.target.closest('[data-tmux-connect]');
  if (btn) connectToTmux(btn.dataset.tmuxConnect, btn);
});
```

## Consequences

- CSP nonce が全ページで一貫して動作し、インラインスクリプトの実行が保証される
- `onclick` 属性がゼロになり、CSP 違反のリスクが排除される
- 今後新しいインラインスクリプトやイベントハンドラを追加する際も同パターンに従う必要がある
