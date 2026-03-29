# ADR: Debounced Terminal Reinitialize on Layout Changes

**Date**: 2026-03-29
**Status**: Accepted

## Context

xterm.js の Canvas/WebGL レンダラーは、レイアウト変更（フォントサイズ変更、ツールバー表示切替、モバイルキーボード表示/非表示）後に描画が崩れることがある。`reinitialize()` で xterm.js インスタンスを再生成すれば修正されるが、重い処理のため頻繁に呼ぶとパフォーマンスに影響する。

## Decision

全てのレイアウト変更トリガーで **300ms デバウンス付き reinitialize** を実行する。

### トリガー一覧

| トリガー | 場所 | デバウンス方法 |
|---------|------|---------------|
| ズームボタン（+/-） | `TerminalController.setFontSize()` | `scheduleReinit()` |
| ピンチズーム | `TouchGestureHandler` → `setFontSize()` | 同上 |
| Ctrl+スクロール | → `zoomTerminal()` → `setFontSize()` | 同上 |
| ツールバートグル | `Toolbar.toggleToolbar()` | `scheduleReinit()` |
| キーボード表示/非表示 | `TerminalClient` visualViewport resize | `reinitTimer` (300ms) |

### 実装パターン

```typescript
// TerminalController — ズーム・トグル用
scheduleReinit(afterReinit?: () => void): void {
  if (this.reinitTimer) clearTimeout(this.reinitTimer);
  this.reinitTimer = setTimeout(() => {
    this.reinitTimer = null;
    this.reinitialize();
    afterReinit?.();
  }, 300);
}

// TerminalClient — visualViewport 用
vv.addEventListener('resize', () => {
  scheduleFit();
  if (this.reinitTimer) clearTimeout(this.reinitTimer);
  this.reinitTimer = setTimeout(() => {
    this.reinitTimer = null;
    this.reinitialize();
  }, 300);
});
```

## Consequences

- 連続操作（ピンチ中、トグル連打）では最後の操作から 300ms 後に1回だけ reinit
- 単発操作（ボタンクリック1回）でも 300ms の遅延があるが、体感上問題なし
- `reinitialize()` は WebSocket を維持したまま xterm.js のみ再生成するため、接続は切れない
