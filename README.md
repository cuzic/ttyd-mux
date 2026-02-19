# ttyd-mux

[![CI](https://github.com/cuzic/ttyd-mux/actions/workflows/ci.yml/badge.svg)](https://github.com/cuzic/ttyd-mux/actions/workflows/ci.yml)
![Coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/cuzic/cc6203266343ecd145c80ea0e848fb33/raw/ttyd-mux-coverage.json)
[![npm version](https://img.shields.io/npm/v/ttyd-mux.svg)](https://www.npmjs.com/package/ttyd-mux)
[![npm downloads](https://img.shields.io/npm/dm/ttyd-mux.svg)](https://www.npmjs.com/package/ttyd-mux)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A CLI tool for managing multiple ttyd+tmux web terminal sessions.

複数の ttyd+tmux Web ターミナルセッションを管理する CLI ツール。

---

## Table of Contents / 目次

- [Quick Start](#quick-start--クイックスタート)
- [Features](#features--機能)
- [Use Cases](#use-cases--ユースケース)
- [Installation](#installation--インストール)
- [Usage Patterns](#usage-patterns--使い方)
- [Commands](#commands--コマンド)
- [Configuration](#configuration--設定)
- [Architecture](#architecture--アーキテクチャ)
- [Toolbar Features](#toolbar-features--ツールバー機能)
- [Notifications](#notifications--通知機能)
- [Share Links](#share-links--共有リンク)
- [PWA Support](#pwa-support--pwa-対応)
- [Caddy Integration](#caddy-integration--caddy-との連携)
- [Development](#development--開発)

---

## Quick Start / クイックスタート

```bash
# Install / インストール
npm install -g ttyd-mux

# Start terminal in current directory / カレントディレクトリでターミナル起動
cd ~/my-project
ttyd-mux up

# Open in browser / ブラウザで開く
# → http://localhost:7680/ttyd-mux/my-project/

# Stop / 停止
ttyd-mux down
```

That's it! No configuration needed for basic usage.

基本的な利用には設定不要です。

---

## Features / 機能

### Core Features / コア機能

| Feature | Description |
|---------|-------------|
| **Zero Config** | Just run `ttyd-mux up` - no setup required / 設定不要で即起動 |
| **Multi-Session** | Manage multiple terminals from one portal / ポータルで複数ターミナルを一元管理 |
| **Auto Daemon** | Daemon starts automatically when needed / 必要時にデーモン自動起動 |
| **tmux Integration** | Sessions persist across restarts / tmux でセッション永続化 |
| **Reverse Proxy Ready** | Works with Caddy, nginx, etc. / リバースプロキシ対応 |

### Mobile Features / モバイル機能

| Feature | Description |
|---------|-------------|
| **PWA Support** | Add to home screen, fullscreen mode / ホーム画面追加、フルスクリーン |
| **IME Input** | Japanese/CJK input support / 日本語入力対応 |
| **Touch Zoom** | Pinch to resize font / ピンチでフォントサイズ変更 |
| **Double-tap Enter** | Quick command execution / ダブルタップで Enter |
| **Scroll Buttons** | Easy scrollback navigation / スクロール用ボタン |
| **Search** | Find text in terminal scrollback / スクロールバック内検索 |
| **Push Notifications** | Bell icon for remote alerts / 通知用ベルアイコン |

### PC Features / PC 機能

| Feature | Description |
|---------|-------------|
| **Ctrl+Scroll Zoom** | Mouse wheel font resize / マウスホイールでサイズ変更 |
| **Trackpad Pinch** | Mac gesture support / Mac トラックパッド対応 |
| **Toolbar Toggle** | Ctrl+J to show/hide / Ctrl+J で表示切替 |
| **Auto Reload** | Reconnects on tab switch / タブ切替時に自動再接続 |

---

## Use Cases / ユースケース

### 1. AI Coding Assistant Monitoring / AI コーディングアシスタントの監視

Monitor long-running AI coding sessions (like Claude Code) from anywhere.

Claude Code などの AI コーディングセッションをどこからでも監視。

```bash
# On your server / サーバー上で
cd ~/my-ai-project
ttyd-mux up

# Access from phone/tablet / スマホ・タブレットからアクセス
# https://your-server.com/ttyd-mux/my-ai-project/
```

### 2. Remote Development / リモート開発

Access your development environment from any device with a browser.

ブラウザさえあればどのデバイスからでも開発環境にアクセス。

```bash
# Start multiple project terminals / 複数プロジェクトを起動
cd ~/project-a && ttyd-mux up
cd ~/project-b && ttyd-mux up

# List all sessions / セッション一覧
ttyd-mux list --url
```

### 3. Server Administration / サーバー管理

Predefined sessions for server operations.

サーバー操作用の事前定義セッション。

```yaml
# ~/.config/ttyd-mux/config.yaml
sessions:
  - name: logs
    dir: /var/log
  - name: docker
    dir: /opt/docker
  - name: admin
    dir: /root
```

```bash
ttyd-mux daemon start --sessions
```

### 4. Pair Programming / ペアプログラミング

Share your terminal with team members via browser.

ブラウザ経由でチームメンバーとターミナルを共有。

---

## Motivation / 開発動機

**English:**
This tool was developed to easily access terminal sessions running AI coding assistants like [Claude Code](https://docs.anthropic.com/en/docs/claude-code) from a web browser. When running long coding sessions with AI assistants on a remote server, you can monitor and interact with them from anywhere through your browser.

**日本語:**
このツールは、[Claude Code](https://docs.anthropic.com/ja/docs/claude-code) などの AI コーディングアシスタントを実行しているターミナルセッションに、ブラウザから簡単にアクセスできるようにする目的で開発されました。リモートサーバーで AI アシスタントと長時間のコーディングセッションを実行する際、ブラウザからどこからでも監視・操作できます。

---

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

# Check installation / インストール確認
ttyd-mux doctor
```

---

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

# List sessions with URLs / URLと一緒にセッション一覧
ttyd-mux list --url

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

---

## Commands / コマンド

### Session Commands / セッションコマンド

| Command | Description |
|---------|-------------|
| `ttyd-mux up` | Start session for current directory / セッション起動 |
| `ttyd-mux down` | Stop session for current directory / セッション停止 |
| `ttyd-mux down --kill-tmux` | Stop session and terminate tmux / tmux も終了 |
| `ttyd-mux status` | Show daemon and session status / 状態表示 |
| `ttyd-mux list` | List active sessions / セッション一覧 |
| `ttyd-mux list -l` | List with details (port, directory) / 詳細表示 |
| `ttyd-mux list --url` | List with access URLs / URL 表示 |
| `ttyd-mux attach [name]` | Attach to tmux session directly / tmux に直接接続 |

### Share Commands / 共有コマンド

| Command | Description |
|---------|-------------|
| `ttyd-mux share` | Create read-only share link / 読み取り専用共有リンク作成 |
| `ttyd-mux share list` | List active shares / アクティブな共有一覧 |
| `ttyd-mux share revoke <token>` | Revoke a share / 共有を取り消し |

### Daemon Control / デーモン制御

| Command | Description |
|---------|-------------|
| `ttyd-mux daemon start` | Start daemon only / デーモンのみ起動 |
| `ttyd-mux daemon start --sessions` | Start daemon + all predefined sessions / 全セッションも起動 |
| `ttyd-mux daemon start -s` | Start daemon + select sessions / 選択して起動 |
| `ttyd-mux daemon start -f` | Start in foreground (debug) / フォアグラウンド起動 |
| `ttyd-mux daemon stop` | Stop daemon / デーモン停止 |
| `ttyd-mux daemon stop -s` | Stop all sessions + daemon / セッションも停止 |
| `ttyd-mux daemon stop -s --kill-tmux` | Stop all + terminate tmux / tmux も終了 |
| `ttyd-mux daemon reload` | Reload config (hot-reload) / 設定リロード |
| `ttyd-mux daemon restart` | Restart daemon / デーモン再起動 |

### Utilities / ユーティリティ

| Command | Description |
|---------|-------------|
| `ttyd-mux doctor` | Check dependencies and configuration / 診断 |
| `ttyd-mux deploy` | Generate static files (for static mode) / 静的ファイル生成 |

### Caddy Integration / Caddy 連携

| Command | Description |
|---------|-------------|
| `ttyd-mux caddy setup` | Add route via Caddy Admin API / ルート追加 |
| `ttyd-mux caddy remove` | Remove route / ルート削除 |
| `ttyd-mux caddy status` | Show routes in Caddy / ルート確認 |
| `ttyd-mux caddy sync` | Sync routes (static mode) / ルート同期 |
| `ttyd-mux caddy snippet` | Show Caddyfile snippet / スニペット表示 |

---

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

# Toolbar settings (proxy mode only)
toolbar:
  font_size_default_mobile: 32
  font_size_default_pc: 14
  font_size_min: 10
  font_size_max: 48

# Predefined sessions for static usage / 静的利用のためのセッション定義
sessions:
  - name: project-a
    dir: /home/user/project-a
  - name: project-b
    dir: /home/user/project-b
```

---

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
                 │  - Toolbar   │
                 │  - API       │
                 └──────────────┘
```

- **Caddy**: Forwards external requests to ttyd-mux / 外部からのリクエストを ttyd-mux に転送
- **ttyd-mux daemon**: Portal + reverse proxy + toolbar injection / ポータル + プロキシ + ツールバー注入
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

### Session Lifecycle / セッションのライフサイクル

Each session consists of three independent processes:

各セッションは3つの独立したプロセスで構成されています：

```
ttyd-mux daemon (manages sessions)
    │
    └── ttyd (web terminal server)
            │
            └── tmux session (terminal multiplexer)
```

**What happens when stopping:**

**停止時の挙動：**

| Command | daemon | ttyd | tmux |
|---------|--------|------|------|
| `daemon stop` | Stops | Keeps running | Keeps running |
| `daemon stop -s` | Stops | Stops | **Keeps running** |
| `daemon stop -s --kill-tmux` | Stops | Stops | Stops |
| `down` | - | Stops | **Keeps running** |
| `down --kill-tmux` | - | Stops | Stops |
| `exit` in terminal | - | Stops | Stops |

- By default, tmux sessions persist even when ttyd or daemon is stopped
- Restarting with `ttyd-mux up` reconnects to existing tmux session
- Use `--kill-tmux` flag to fully terminate tmux sessions

- デフォルトでは tmux セッションは ttyd やデーモンを停止しても残ります
- `ttyd-mux up` で再起動すると既存の tmux セッションに再接続します
- `--kill-tmux` フラグで tmux セッションも完全に終了できます

---

## Toolbar Features / ツールバー機能

In proxy mode, ttyd-mux injects a toolbar for improved input experience:

プロキシモードでは、入力体験向上のためツールバーが注入されます：

### Mobile / モバイル

- **IME Input**: Text field with virtual keyboard support / 日本語 IME 対応テキスト入力
- **Touch Pinch Zoom**: Two-finger pinch to resize font / 2本指ピンチでフォントサイズ変更
- **Double-tap Enter**: Double-tap to send Enter key / ダブルタップで Enter 送信
- **Scroll Buttons**: PgUp/PgDn for scrollback / スクロールバック用ボタン
- **Minimize Mode**: Collapse toolbar for more terminal space / ツールバー最小化

### PC Browser / PC ブラウザ

- **Ctrl+Scroll Zoom**: Mouse wheel with Ctrl key / Ctrl+マウスホイールでサイズ変更
- **Trackpad Pinch Zoom** (Mac): Two-finger pinch gesture / トラックパッドピンチ
- **Ctrl+J Toggle**: Show/hide toolbar / ツールバー表示切替
- **Ctrl+Shift+F**: Open search bar / 検索バーを開く

---

## Notifications / 通知機能

Get notified when something happens in your terminal sessions.

ターミナルセッションで何かが起きたときに通知を受け取れます。

### Push Notifications / プッシュ通知

Receive browser push notifications even when the tab is closed.

タブを閉じていてもブラウザのプッシュ通知を受け取れます。

**Setup / 設定:**
1. Click the bell icon (🔔) in the toolbar / ツールバーのベルアイコンをクリック
2. Allow notifications when prompted / 通知を許可
3. Notifications are sent on terminal bell (`\a`) / ターミナルベル（`\a`）で通知

**Use cases / 活用例:**
```bash
# Notify when command completes / コマンド完了時に通知
long-running-command; echo -e '\a'

# Or use bell directly / または直接ベルを使用
sleep 300 && printf '\a'
```

### Custom Notification Patterns / カスタム通知パターン

Configure patterns to trigger notifications:

通知トリガーのパターンを設定:

```yaml
# ~/.config/ttyd-mux/config.yaml
notifications:
  triggers:
    - type: bell  # Terminal bell (default)
    - type: pattern
      pattern: "ERROR|FAILED"
      flags: "i"
```

---

## Share Links / 共有リンク

Share read-only access to your terminal sessions.

ターミナルセッションへの読み取り専用アクセスを共有できます。

### Create Share Link / 共有リンク作成

```bash
# Share current session for 1 hour (default)
# 現在のセッションを1時間共有（デフォルト）
ttyd-mux share

# Share specific session for 24 hours
# 特定のセッションを24時間共有
ttyd-mux share my-session --expires 24h

# Share with custom expiry
# カスタム有効期限で共有
ttyd-mux share --expires 30m   # 30 minutes
ttyd-mux share --expires 7d    # 7 days
```

### Manage Shares / 共有の管理

```bash
# List active shares / アクティブな共有一覧
ttyd-mux share list

# Revoke a share / 共有を取り消し
ttyd-mux share revoke <token>
```

### Features / 機能

- **Read-only**: Viewers can see but not interact / 閲覧のみ、操作不可
- **Time-limited**: Links expire automatically / 自動的に期限切れ
- **Revocable**: Cancel access anytime / いつでもアクセス取り消し可能

---

## PWA Support / PWA 対応

ttyd-mux supports Progressive Web App (PWA) for a native app-like experience:

ttyd-mux はネイティブアプリのような体験のため PWA に対応しています：

### Features / 機能

- **Fullscreen Mode**: No browser address bar / アドレスバーなしのフルスクリーン
- **Home Screen Icon**: Add to home screen on iOS/Android / ホーム画面にアイコン追加
- **Auto Reconnect**: Automatically reloads when returning from background / バックグラウンドから復帰時に自動再接続

### How to Install / インストール方法

**Android (Chrome):**
1. Open portal page / ポータルページを開く
2. Menu → "Add to Home screen" / メニュー → 「ホーム画面に追加」

**iOS (Safari):**
1. Open portal page / ポータルページを開く
2. Share → "Add to Home Screen" / 共有 → 「ホーム画面に追加」

---

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

### Authentication / 認証

For external access, configure authentication in Caddy:

外部公開時は Caddy で認証を設定：

```caddyfile
example.com {
    # Basic authentication
    basicauth /ttyd-mux/* {
        user $2a$14$... # bcrypt hash
    }

    handle /ttyd-mux/* {
        reverse_proxy 127.0.0.1:7680
    }
}
```

See [docs/caddy-setup.md](docs/caddy-setup.md) for details, including OAuth setup.

---

## File Structure / ファイル構成

```
~/.config/ttyd-mux/
  config.yaml           # Configuration file / 設定ファイル

~/.local/state/ttyd-mux/
  state.json            # Running session state / 実行中セッションの状態
  ttyd-mux.sock         # Daemon communication socket / デーモン通信用ソケット
```

---

## Development / 開発

```bash
# Clone repository
git clone https://github.com/cuzic/ttyd-mux.git
cd ttyd-mux

# Install dependencies
bun install

# Run in development / 開発実行
bun run src/index.ts <command>

# Test / テスト
bun test                  # Unit tests
bun run test:e2e          # E2E tests (Playwright)

# Type check / 型チェック
bun run typecheck

# Lint / リント
bun run check

# Build / ビルド
bun run build
```

---

## Contributing / 貢献

Issues and Pull Requests are welcome!

Issue や Pull Request を歓迎します！

See [CLAUDE.md](CLAUDE.md) for development guidelines.

---

## License / ライセンス

MIT
