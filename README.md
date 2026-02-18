# ttyd-mux

[![CI](https://github.com/cuzic/ttyd-mux/actions/workflows/ci.yml/badge.svg)](https://github.com/cuzic/ttyd-mux/actions/workflows/ci.yml)
![Coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/cuzic/cc6203266343ecd145c80ea0e848fb33/raw/ttyd-mux-coverage.json)

A CLI tool for managing multiple ttyd+tmux web terminal sessions.

複数の ttyd+tmux Web ターミナルセッションを管理する CLI ツール。

---

## Motivation / 開発動機

**English:**
This tool was developed to easily access terminal sessions running AI coding assistants like [Claude Code](https://docs.anthropic.com/en/docs/claude-code) from a web browser. When running long coding sessions with AI assistants on a remote server, you can monitor and interact with them from anywhere through your browser.

**日本語:**
このツールは、[Claude Code](https://docs.anthropic.com/ja/docs/claude-code) などの AI コーディングアシスタントを実行しているターミナルセッションに、ブラウザから簡単にアクセスできるようにする目的で開発されました。リモートサーバーで AI アシスタントと長時間のコーディングセッションを実行する際、ブラウザからどこからでも監視・操作できます。

---

## Overview / 概要

**English:**
ttyd-mux makes it easy to manage multiple web terminal (ttyd) sessions.

- Run `ttyd-mux up` in any directory to start a browser-accessible terminal
- Provides a portal page to manage all sessions
- Integrates with reverse proxies like Caddy for external access
- Perfect for monitoring AI coding assistants like Claude Code remotely

**日本語:**
ttyd-mux は、複数の Web ターミナル（ttyd）セッションを簡単に管理するためのツールです。

- カレントディレクトリで `ttyd-mux up` するだけでブラウザアクセス可能なターミナルを起動
- 複数セッションを一元管理するポータルページを提供
- Caddy などのリバースプロキシと連携して外部公開
- Claude Code などの AI コーディングアシスタントをリモートから監視するのに最適

## Installation / インストール

```bash
# Install globally with npm
# npm でグローバルインストール
npm install -g ttyd-mux

# Or run directly with npx
# または npx で直接実行
npx ttyd-mux up
```

### Prerequisites / 必要な依存関係

- **Node.js** 18+ (or Bun)
- **ttyd**: https://github.com/tsl0922/ttyd
- **tmux**: Terminal multiplexer

```bash
# Ubuntu/Debian
sudo apt install ttyd tmux

# macOS (Homebrew)
brew install ttyd tmux
```

## Quick Start / クイックスタート

```bash
# Start in your project directory
# プロジェクトディレクトリで起動
cd ~/my-project
ttyd-mux up

# Access in browser / ブラウザでアクセス
# http://localhost:7680/ttyd-mux/my-project/

# Check status / 状態確認
ttyd-mux status

# Stop / 停止
ttyd-mux down
```

## Commands / コマンド

### Main Commands / メインコマンド

```bash
ttyd-mux up [--name <name>]     # Start session and attach / セッション起動 → 自動アタッチ
ttyd-mux up --detach            # Start without attaching / セッション起動のみ（アタッチしない）
ttyd-mux down                   # Stop current directory session / カレントディレクトリのセッション停止
```

### Session Management / セッション管理

```bash
ttyd-mux start <name>           # Start predefined session / 事前定義セッションを起動
ttyd-mux start --all            # Start all predefined sessions / 全ての事前定義セッションを起動
ttyd-mux stop <name>            # Stop session / セッション停止
ttyd-mux stop --all             # Stop all sessions / 全セッション停止
ttyd-mux status                 # Show status / 状態表示
```

### Direct Access / 直接アクセス

```bash
ttyd-mux attach [name]          # Attach directly to tmux session / tmuxセッションに直接アタッチ
```

### Daemon Control / デーモン制御

```bash
ttyd-mux daemon                 # Start daemon / デーモン起動
ttyd-mux daemon -f              # Start in foreground (debug) / フォアグラウンドで起動（デバッグ用）
ttyd-mux shutdown               # Stop daemon / デーモン終了
```

### Diagnostics / 診断

```bash
ttyd-mux doctor                 # Check dependencies and configuration / 依存関係と設定をチェック
```

The `doctor` command checks:
- ttyd installation
- tmux installation
- Bun version (requires 1.0+)
- Configuration file validity
- Daemon status
- Port availability

`doctor` コマンドは以下をチェックします：
- ttyd のインストール
- tmux のインストール
- Bun のバージョン（1.0以上が必要）
- 設定ファイルの妥当性
- デーモンの状態
- ポートの空き状況

## Configuration / 設定

Configuration files are searched in the following order:

設定ファイルは以下の順序で検索されます：

1. `./ttyd-mux.yaml`
2. `./.ttyd-mux.yaml`
3. `~/.config/ttyd-mux/config.yaml`

### Example / 設定例

```yaml
# ~/.config/ttyd-mux/config.yaml

# URL path prefix / URLパスのプレフィックス
base_path: /ttyd-mux

# Base port for ttyd sessions / ttydセッションのベースポート
base_port: 7600

# Daemon HTTP port / デーモンのHTTPポート
daemon_port: 7680

# Listen addresses (default: IPv4 + IPv6 localhost)
# リッスンアドレス（デフォルト: IPv4 + IPv6 localhost）
listen_addresses:
  - "127.0.0.1"
  - "::1"
  # - "0.0.0.0"  # Allow external access / 外部からのアクセスを許可する場合

# Unix socket listeners (optional, for reverse proxy integration)
# Unix ソケットリスナー（オプション、リバースプロキシ連携用）
listen_sockets:
  # - /run/ttyd-mux.sock  # Caddy: reverse_proxy unix//run/ttyd-mux.sock

# Auto-attach to tmux on session start (default: true)
# セッション起動時に自動でtmuxにアタッチ（デフォルト: true）
auto_attach: true

# Proxy mode: "proxy" (default) or "static"
# プロキシモード: "proxy"（デフォルト）または "static"
# - proxy: All traffic goes through ttyd-mux daemon (supports IME helper)
# - static: Sessions are accessed directly via Caddy (lower latency)
proxy_mode: proxy

# Hostname for Caddy integration (used by caddy/deploy commands)
# Caddy連携用のホスト名（caddy/deployコマンドで使用）
hostname: example.com

# Caddy Admin API URL
caddy_admin_api: http://localhost:2019

# Predefined sessions (optional) / 事前定義セッション（オプション）
sessions:
  - name: project-a
    dir: /home/user/project-a
    path: /project-a
    port_offset: 1

  - name: project-b
    dir: /home/user/project-b
    path: /project-b
    port_offset: 2
```

## Architecture / アーキテクチャ

### Proxy Mode (default) / プロキシモード（デフォルト）

```
                                    ┌─────────────────┐
                                    │   ttyd :7601    │
                                    │ (-b /ttyd-mux/  │
┌─────────┐      ┌──────────────┐   │    project-a)   │
│  Caddy  │──────│  ttyd-mux    │───┼─────────────────┤
│         │      │  daemon      │   │   ttyd :7602    │
│ :443    │      │  :7680       │   │ (-b /ttyd-mux/  │
└─────────┘      │              │   │    project-b)   │
                 │  - Portal    │   └─────────────────┘
                 │  - Proxy     │
                 │  - API       │
                 └──────────────┘
```

- **Caddy**: Forwards external requests to ttyd-mux / 外部からのリクエストを ttyd-mux に転送
- **ttyd-mux daemon**: Portal + reverse proxy to ttyd / ポータル表示 + ttyd へのリバースプロキシ
- **ttyd**: Web terminal for each session (runs tmux) / 各セッションの Web ターミナル（tmux を起動）

### Static Mode / スタティックモード

```
                 ┌──────────────┐   ┌─────────────────┐
                 │ Static HTML  │   │   ttyd :7601    │
┌─────────┐      │ (portal)     │   │    project-a    │
│  Caddy  │──────┼──────────────┼───┼─────────────────┤
│         │      │              │   │   ttyd :7602    │
│ :443    │      │              │   │    project-b    │
└─────────┘      └──────────────┘   └─────────────────┘
```

- Lower latency (no intermediate proxy) / 低レイテンシ（中間プロキシなし）
- Static portal (no daemon needed at runtime) / 静的ポータル（実行時デーモン不要）
- No IME helper support / IME ヘルパー非対応

## Toolbar Features / ツールバー機能

In proxy mode, ttyd-mux injects a toolbar for improved input experience:

プロキシモードでは、入力体験向上のためツールバーが注入されます：

### Mobile Support / モバイル対応

- **IME Input**: Virtual keyboard with Japanese IME support / 日本語 IME 対応の仮想キーボード
- **Touch Pinch Zoom**: Two-finger pinch to resize terminal font (requires Ctrl/Shift button) / 2本指ピンチでフォントサイズ変更（Ctrl/Shift ボタン押下時）
- **Double-tap Enter**: Double-tap to send Enter key / ダブルタップで Enter キー送信
- **Minimize Mode**: Compact toolbar showing only input field / コンパクト表示（入力フィールドのみ）
- **Onboarding Tips**: First-time usage hints / 初回利用時のヒント表示

### PC Browser Support / PC ブラウザ対応

- **Ctrl+Scroll Zoom**: Mouse wheel with Ctrl key to resize terminal font / Ctrl+マウスホイールでフォントサイズ変更
- **Trackpad Pinch Zoom** (Mac): Two-finger pinch gesture on trackpad / トラックパッドの2本指ピンチでフォントサイズ変更
- **A-/A+ Buttons**: Click buttons in the toolbar / ツールバーのボタンでサイズ変更
- **Ctrl+J Toggle**: Keyboard shortcut to show/hide toolbar / Ctrl+J でツールバー表示/非表示

## Caddy Integration / Caddy との連携

### Using Admin API (Recommended) / Admin API で設定（推奨）

```bash
# Add route / ルートを追加
ttyd-mux caddy setup --hostname example.com

# Check configuration / 設定を確認
ttyd-mux caddy status

# Remove route / ルートを削除
ttyd-mux caddy remove --hostname example.com
```

### Manual Caddyfile / Caddyfile 手動編集

```bash
# Show snippet for copy-paste / コピペ用スニペットを表示
ttyd-mux caddy snippet
```

```caddyfile
handle /ttyd-mux/* {
    reverse_proxy 127.0.0.1:7680
}
```

### Static Mode / スタティックモード

For lower latency, use static mode where Caddy routes directly to ttyd:

低レイテンシのために、Caddy から ttyd に直接ルーティングするスタティックモード：

```yaml
# config.yaml
proxy_mode: static
hostname: example.com
```

```bash
# Generate static portal and Caddyfile snippet
# 静的ポータルと Caddyfile スニペットを生成
ttyd-mux deploy

# Sync routes after starting/stopping sessions
# セッション開始/停止後にルートを同期
ttyd-mux caddy sync
```

See [docs/caddy-setup.md](docs/caddy-setup.md) for details, including authentication setup (Basic, OAuth, mTLS, Authelia/Authentik) for external access.

## File Structure / ファイル構成

```
~/.config/ttyd-mux/
  config.yaml           # Configuration file / 設定ファイル

~/.local/state/ttyd-mux/
  state.json            # Running session state / 実行中セッションの状態
  ttyd-mux.sock         # Daemon communication socket / デーモン通信用ソケット
```

## Development / 開発

```bash
# Run in development / 開発実行
bun run src/index.ts <command>

# Test / テスト
bun test

# Type check / 型チェック
bun run typecheck

# Lint / リント
bun run check

# Build single executable / ビルド（単一実行ファイル）
bun build src/index.ts --compile --outfile ttyd-mux
```

## License / ライセンス

MIT
