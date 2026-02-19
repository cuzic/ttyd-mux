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

## Usage Patterns / 使い方

ttyd-mux has two main usage patterns:

ttyd-mux には2つの利用パターンがあります：

### Dynamic Usage (Ad-hoc Sessions) / 動的利用

Start sessions on-demand in any directory. No configuration needed.

設定不要で、任意のディレクトリでその場でセッションを起動。

```bash
# Start in your project directory / プロジェクトディレクトリで起動
cd ~/my-project
ttyd-mux up

# Access in browser / ブラウザでアクセス
# http://localhost:7680/ttyd-mux/my-project/

# Check status / 状態確認
ttyd-mux status

# Stop / 停止
ttyd-mux down
```

### Static Usage (Predefined Sessions) / 静的利用

Define sessions in config.yaml and start them all at once. Ideal for servers.

config.yaml にセッションを定義し、一括起動。サーバー運用に最適。

```yaml
# ~/.config/ttyd-mux/config.yaml
sessions:
  - name: project-a
    dir: /home/user/project-a
  - name: project-b
    dir: /home/user/project-b
```

```bash
# Start daemon + all predefined sessions / デーモンと全セッションを起動
ttyd-mux daemon start --sessions

# Or select sessions interactively / またはインタラクティブに選択
ttyd-mux daemon start -s

# Stop daemon + all sessions / デーモンと全セッションを停止
ttyd-mux daemon stop --stop-sessions
```

## Commands / コマンド

### Session Commands / セッションコマンド

```bash
ttyd-mux up                     # Start session for current directory
ttyd-mux down                   # Stop session for current directory
ttyd-mux status                 # Show status
ttyd-mux attach [name]          # Attach to tmux session directly
```

### Daemon Control / デーモン制御

```bash
ttyd-mux daemon start           # Start daemon only
ttyd-mux daemon start --sessions  # Start daemon + all predefined sessions
ttyd-mux daemon start -s        # Start daemon + select sessions interactively
ttyd-mux daemon start -f        # Start in foreground (debug)
ttyd-mux daemon stop            # Stop daemon
ttyd-mux daemon stop --stop-sessions  # Stop all sessions + daemon
ttyd-mux daemon reload          # Reload config (hot-reload)
ttyd-mux daemon restart         # Restart daemon (apply code updates)
```

### Diagnostics / 診断

```bash
ttyd-mux doctor                 # Check dependencies and configuration
```

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
listen_addresses:
  - "127.0.0.1"
  - "::1"

# Proxy mode: "proxy" (default) or "static"
# - proxy: All traffic goes through daemon (supports toolbar)
# - static: Sessions accessed directly via Caddy (lower latency)
proxy_mode: proxy

# Hostname for Caddy integration
hostname: example.com

# Predefined sessions for static usage / 静的利用のためのセッション定義
sessions:
  - name: project-a
    dir: /home/user/project-a
  - name: project-b
    dir: /home/user/project-b
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
- No toolbar support / ツールバー非対応

## Toolbar Features / ツールバー機能

In proxy mode, ttyd-mux injects a toolbar for improved input experience:

プロキシモードでは、入力体験向上のためツールバーが注入されます：

### Mobile Support / モバイル対応

- **IME Input**: Virtual keyboard with Japanese IME support / 日本語 IME 対応
- **Touch Pinch Zoom**: Two-finger pinch to resize font / 2本指ピンチでフォントサイズ変更
- **Double-tap Enter**: Double-tap to send Enter key / ダブルタップで Enter 送信
- **Scroll Buttons**: PgUp/PgDn for scrolling / スクロール用ボタン

### PC Browser Support / PC ブラウザ対応

- **Ctrl+Scroll Zoom**: Mouse wheel with Ctrl key / Ctrl+マウスホイールでサイズ変更
- **Trackpad Pinch Zoom** (Mac): Two-finger pinch gesture / トラックパッドピンチ
- **Ctrl+J Toggle**: Show/hide toolbar / ツールバー表示切替

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

See [docs/caddy-setup.md](docs/caddy-setup.md) for details, including authentication setup.

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
