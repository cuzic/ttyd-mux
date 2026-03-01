# Option C 実装レビュー

レビュー日: 2026-03-01

## 現在のアーキテクチャ分析

### ttyd が提供している機能

1. **xterm.js の配信**: ttyd がバンドルした HTML/JS/CSS を配信
2. **WebSocket サーバー**: バイナリプロトコルで PTY と通信
3. **PTY 管理**: forkpty(3) でシェルを起動
4. **ZMODEM**: ファイル転送 (lrzsz 統合)
5. **認証**: Basic 認証、クライアント証明書

### ttyd-mux が提供している機能

1. **WebSocket プロキシ**: ttyd への中継
2. **HTML 注入**: terminal-ui.js、スタイル、設定
3. **terminal-ui.js**:
   - WebSocket インターセプト (`window.__TTYD_WS__`)
   - フォントサイズ制御
   - 検索機能 (Ctrl+Shift+F)
   - タッチジェスチャー
   - クリップボード履歴
   - プレビュー機能

---

## 実装上の課題と解決策

### 課題 1: xterm.js の配信 ⚠️ 重要

**現状**: ttyd が xterm.js 5.4.0 をバンドルして配信

**Bun.Terminal では**: 自前で xterm.js を配信する必要あり

**必要なもの**:
- xterm.js 本体
- @xterm/addon-fit (リサイズ)
- @xterm/addon-web-links (URL クリック)
- @xterm/addon-unicode11 (絵文字サポート)
- @xterm/addon-serialize (将来の AI 用)

**解決策**:
```bash
# クライアント用 xterm.js バンドルを作成
bun add @xterm/xterm @xterm/addon-fit @xterm/addon-web-links @xterm/addon-unicode11
```

```typescript
// scripts/build-xterm-client.mjs
// xterm.js + addons をバンドルして dist/xterm-bundle.js を生成
```

**追加タスク必要**: xterm.js クライアントバンドルの作成

---

### 課題 2: HTML テンプレート ⚠️ 重要

**現状**: ttyd の HTML を取得して terminal-ui を注入

**Bun.Terminal では**: 完全な HTML を自前で生成

**必要な HTML 構造**:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Session Name - ttyd-mux</title>
  <link rel="stylesheet" href="/ttyd-mux/xterm.css">
  <!-- terminal-ui styles -->
</head>
<body>
  <div id="terminal"></div>
  <!-- terminal-ui HTML -->
  <script src="/ttyd-mux/xterm-bundle.js"></script>
  <script src="/ttyd-mux/terminal-client.js"></script>
  <script src="/ttyd-mux/terminal-ui.js"></script>
</body>
</html>
```

**解決策**: 新しい HTML テンプレートモジュール作成

**追加タスク必要**: ネイティブターミナル用 HTML テンプレート

---

### 課題 3: WebSocket プロトコル設計

**方針**: ttyd 互換性は不要。最適なプロトコルを新規設計

**推奨プロトコル設計**:

```typescript
// JSON ベースのメッセージプロトコル
type ClientMessage =
  | { type: 'input'; data: string }        // ターミナル入力
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'ping' }

type ServerMessage =
  | { type: 'output'; data: string }       // ターミナル出力
  | { type: 'title'; title: string }
  | { type: 'exit'; code: number }
  | { type: 'pong' }
  | { type: 'error'; message: string }
```

**メリット**:
- デバッグしやすい (JSON なのでログで読める)
- 拡張しやすい (新しいメッセージタイプを追加可能)
- 型安全 (TypeScript で厳密に型定義)

**バイナリ vs JSON**:
- 出力データが大量の場合、バイナリの方が効率的
- ハイブリッド: output のみ `ArrayBuffer`、他は JSON

**実装の複雑さ**: 低 (自由に設計できるため)

---

### 課題 4: terminal-ui.js の互換性

**現状の動作**:
- `window.__TTYD_WS__` を通じて ttyd の WebSocket をインターセプト
- `window.term` で ttyd の xterm インスタンスにアクセス
- `window.fitAddon` でリサイズ

**Bun.Terminal では**:
- WebSocket は自前で作成 → インターセプト不要
- xterm インスタンスも自前 → 直接参照可能

**影響**:
- `WebSocketConnection.ts`: 変更必要
- `TerminalController.ts`: 軽微な変更
- その他: 影響なし

**解決策**: terminal-ui.js の初期化ロジックを調整

**追加タスク必要**: terminal-ui.js のネイティブターミナル対応

---

### 課題 5: 複数クライアント接続

**ttyd の動作**: 複数クライアントが同一セッションに接続可能

**実装要件**:
- 各セッションにクライアント Set を保持
- 出力を全クライアントにブロードキャスト
- 入力は全クライアントから受け付け (競合注意)

**実装の複雑さ**: 低

**解決策**: TerminalSession クラスで実装済み (設計上)

---

### 課題 6: ZMODEM ファイル転送

**現状**: ttyd が ZMODEM をサポート (`lrzsz` 統合)

**Bun.Terminal では**: ZMODEM 非サポート

**影響**: 低 - 既存の HTTP ファイル転送 API がある

**解決策**: ZMODEM は非サポートとして文書化

---

### 課題 7: tmux 統合

**現状**:
```bash
ttyd -W -p 7601 -b /ttyd-mux/session-name tmux attach-session -t session-name
```

**Bun.Terminal では**:
```typescript
Bun.spawn(['tmux', 'attach-session', '-t', sessionName], {
  terminal: { cols, rows, data: handleOutput },
  cwd: dir,
});
```

**実装の複雑さ**: 低

**解決策**: 既存の tmux 管理ロジック (TmuxClient) を再利用

---

### 課題 8: 認証

**現状**: ttyd-mux は認証機能を持たない (ttyd の認証も使っていない)

**Bun.Terminal では**: 変更なし

**解決策**: 現状維持 (将来的に認証を追加する場合は別途検討)

---

## 修正が必要なタスク一覧

### 追加が必要なタスク

| # | タスク | 理由 |
|---|--------|------|
| 新規 | xterm.js クライアントバンドルの作成 | xterm.js を自前配信する必要 |
| 新規 | ネイティブターミナル用 HTML テンプレート | ttyd の HTML が使えない |
| 新規 | terminal-ui.js のネイティブターミナル対応 | 初期化ロジックの調整 |

### 既存タスクの修正

| # | タスク | 修正内容 |
|---|--------|---------|
| #3 | WebSocket プロトコル処理 | 初期化シーケンス詳細を追加 |
| #5 | WebSocket サーバー | HTML 配信機能を追加 |

---

## リスク評価

| リスク | 影響度 | 発生確率 | 対策 |
|--------|--------|---------|------|
| xterm.js バージョン不整合 | 中 | 低 | 最新安定版を使用、テスト徹底 |
| プロトコル実装ミス | 高 | 中 | ttyd のソースを参照、E2E テスト |
| terminal-ui.js 互換性 | 中 | 中 | 段階的移行、fallback 実装 |
| パフォーマンス問題 | 中 | 低 | ベンチマーク、プロファイリング |
| Bun.Terminal バグ | 中 | 低 | 最新版使用、Issue 監視 |

---

## 推奨実装順序

### Phase 1: 基盤 (最小動作版)

1. **#1** ADR 038 作成
2. **新規** xterm.js クライアントバンドル作成
3. **新規** ネイティブターミナル用 HTML テンプレート
4. **#3** WebSocket プロトコル処理 (基本のみ)
5. **#2** TerminalSession クラス (最小実装)
6. **#5** WebSocket サーバー (HTML 配信含む)

**マイルストーン**: ブラウザで基本的なターミナル操作が可能

### Phase 2: 統合

7. **#4** NativeSessionManager
8. **#6** 設定スキーマ拡張
9. **#7** Router 統合

**マイルストーン**: ttyd と並行運用可能

### Phase 3: terminal-ui 対応

10. **新規** terminal-ui.js ネイティブターミナル対応
11. 既存機能の動作確認 (フォント、検索、etc.)

**マイルストーン**: 全 UI 機能が動作

### Phase 4: テスト・品質

12. **#13** ユニットテスト
13. **#15** E2E テスト
14. **#18** CLAUDE.md 更新

---

## 結論

### 実装可能性: ✅ 可能

ただし、以下の追加作業が必要:

1. **xterm.js バンドル**: 新規実装
2. **HTML テンプレート**: 新規実装
3. **terminal-ui.js 対応**: 修正

### 推奨アクション

1. タスク #1 (ADR) から開始
2. xterm.js バンドルのタスクを追加
3. HTML テンプレートのタスクを追加
4. terminal-ui.js 対応のタスクを追加
5. 既存タスクの説明を更新

### 工数見積もり修正

| 項目 | 当初見積もり | 修正見積もり |
|------|------------|------------|
| コア実装 | 2-3 週間 | 3-4 週間 |
| 追加理由 | - | xterm.js バンドル、HTML テンプレート |
