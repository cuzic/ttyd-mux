# CLAUDE.md

このファイルは Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

## プロジェクト概要

**ttyd-mux** は、複数の ttyd+tmux セッションを管理する CLI ツールです。

主な機能:
- カレントディレクトリで `ttyd-mux up` するだけでブラウザアクセス可能なターミナルを起動
- デーモンがポータルページとリバースプロキシを提供
- tmux 風の自動デーモン起動

## 技術スタック

- **ランタイム**: Bun
- **言語**: TypeScript (strict mode)
- **テスト**: Bun test
- **リンター**: Biome
- **依存**: commander, yaml, http-proxy

## ディレクトリ構造

```
src/
├── index.ts              # CLI エントリポイント (Commander)
├── config/
│   ├── types.ts          # 型定義
│   ├── config.ts         # config.yaml 読み込み
│   └── state.ts          # state.json 読み書き
├── daemon/
│   ├── index.ts          # デーモンエントリ
│   ├── server.ts         # HTTP サーバー + API
│   ├── proxy.ts          # WebSocket 対応プロキシ
│   ├── portal.ts         # ポータル HTML 生成
│   └── session-manager.ts # ttyd プロセス管理
├── client/
│   └── index.ts          # デーモン通信クライアント
└── commands/
    ├── up.ts, down.ts    # メインコマンド
    ├── start.ts, stop.ts, status.ts
    ├── attach.ts
    ├── daemon.ts, shutdown.ts
    └── generate.ts
```

## 開発コマンド

```bash
# 実行
bun run src/index.ts <command>

# テスト
bun test

# 型チェック
bun run typecheck

# リント + フォーマット
bun run check
bun run check:fix
bun run format

# ビルド
bun build src/index.ts --compile --outfile ttyd-mux
```

## アーキテクチャの重要ポイント

### デーモンの自動起動

`ttyd-mux up` などのコマンド実行時、デーモンが起動していなければ自動的にバックグラウンドで起動します（tmux と同様の動作）。

```typescript
// client/index.ts
await ensureDaemon();  // デーモンが未起動なら起動
```

### CLI ↔ デーモン通信

- Unix socket (`~/.local/state/ttyd-mux/ttyd-mux.sock`) で生存確認
- HTTP API でセッション操作

### ttyd の起動パラメータ

ttyd はリバースプロキシ経由でアクセスされるため、`-b` オプションでベースパスを指定:

```bash
ttyd -p 7601 -b /ttyd-mux/project-name tmux new -A -s project-name
```

### ファイル分離

- `~/.config/ttyd-mux/config.yaml` - 設定（事前定義セッション等）
- `~/.local/state/ttyd-mux/state.json` - 状態（実行中セッション、PID等）

## コーディング規約

- TypeScript strict mode
- ESM モジュール (`.js` 拡張子でインポート)
- Node protocol imports (`node:fs`, `node:path` 等)
- Biome でフォーマット・リント

## テスト

テストは `bun:test` を使用。各モジュールに対応するテストファイルがあります。

```bash
bun test                    # 全テスト実行
bun test --watch            # ウォッチモード
bun test src/config/        # 特定ディレクトリのみ
```

## 主要な型

```typescript
// 設定ファイル
interface Config {
  base_path: string;      // "/ttyd-mux"
  base_port: number;      // 7600
  daemon_port: number;    // 7680
  sessions?: SessionDefinition[];
}

// 実行中セッション
interface SessionState {
  name: string;
  pid: number;
  port: number;
  path: string;
  dir: string;
  started_at: string;
}
```

## 注意事項

- ttyd がシステムにインストールされている必要があります
- tmux がシステムにインストールされている必要があります
- bun 1.0 以上が必要です
