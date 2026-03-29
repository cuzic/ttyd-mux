# ADR: Clipboard Side-Channel via Unix Socket + WebSocket

**Date**: 2026-03-29
**Status**: Accepted

## Context

bunterm ではブラウザ経由でターミナルにアクセスするため、CLI ツール（toclip 等）からシステムクリップボードに書き込む際に OSC 52 エスケープシーケンスを使用していた。しかし以下の問題があった:

1. **tmux パススルー**: bunterm + tmux 環境では DCS パススルーが必要で、直接 tmux のみの場合は不要。環境判定が複雑
2. **OSC 52 サイズ制限**: 一部ターミナルで 100KB 制限がある
3. **エスケープシーケンスの信頼性**: tmux のバージョンや設定による動作差異

## Decision

OSC 52 に依存せず、bunterm の既存インフラ（Unix domain socket + WebSocket）を活用したクリップボード書き込みの side-channel を実装する。

### アーキテクチャ

```
CLI tool → POST /api/clipboard (Unix socket) → WebSocket broadcast → Browser Clipboard API
```

### コンポーネント

| コンポーネント | 役割 |
|---|---|
| `POST /api/clipboard` | セッション名 + テキストを受け取り WebSocket でブロードキャスト |
| `ClipboardMessage` | WebSocket メッセージ型 `{ type: 'clipboard', text: string }` |
| ブラウザハンドラ | `navigator.clipboard.writeText()` 実行。失敗時はクリック可能なトースト通知 |
| `bunterm copy` | CLI サブコマンド。stdin を読み取り API に送信 |
| `toclip` | `BUNTERM_API_SOCK` があれば side-channel 使用、なければ OSC 52 フォールバック |

### ブラウザ Clipboard API の制約

`navigator.clipboard.writeText()` はブラウザによってユーザージェスチャーが必要:

- **Chrome**: ページにフォーカスがあれば動作（bunterm 使用中は通常フォーカスあり）
- **Firefox/Safari**: ユーザージェスチャーが必須

対策: 失敗時に「Click to copy」ボタン付きトースト通知を表示。クリック = ユーザージェスチャーなので全ブラウザで動作する。

## Alternatives Considered

1. **OSC 52 パススルーの改善**: 環境判定を精密にする案。tmux バージョン依存が残り、根本解決にならない
2. **サーバー側クリップボード**: xclip/xsel 等でサーバーのクリップボードに書き込む案。bunterm はリモートアクセスが主目的のため、サーバー側クリップボードは意味がない

## Consequences

- OSC 52 / tmux パススルーの複雑さを完全に回避
- サイズ制限なし（WebSocket 経由）
- `BUNTERM_API_SOCK` 環境変数で bunterm 配下を自動判定
- OSC 52 をフォールバックとして維持（bunterm 外での互換性）
