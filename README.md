# bunterm

[![CI](https://github.com/cuzic/bunterm/actions/workflows/ci.yml/badge.svg)](https://github.com/cuzic/bunterm/actions/workflows/ci.yml)
![Coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/cuzic/cc6203266343ecd145c80ea0e848fb33/raw/bunterm-coverage.json)
[![npm version](https://img.shields.io/npm/v/bunterm.svg)](https://www.npmjs.com/package/bunterm)
[![npm downloads](https://img.shields.io/npm/dm/bunterm.svg)](https://www.npmjs.com/package/bunterm)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A browser-accessible terminal powered by Bun.

Bun で動作するブラウザアクセス可能なターミナル。

---

## Table of Contents / 目次

- [Quick Start](#quick-start--クイックスタート)
- [Features](#features--機能)
- [Use Cases](#use-cases--ユースケース)
- [Installation](#installation--インストール)
- [Usage](#usage--使い方)
- [Commands](#commands--コマンド)
- [Configuration](#configuration--設定)
- [Block UI](#block-ui--ブロック-ui)
- [AI Integration](#ai-integration--ai-統合)
- [File Operations](#file-operations--ファイル操作)
- [Clipboard & Snippets](#clipboard--snippets--クリップボード--スニペット)
- [HTML Preview](#html-preview--html-プレビュー)
- [Notifications](#notifications--通知機能)
- [Share Links](#share-links--共有リンク)
- [PWA Support](#pwa-support--pwa-対応)
- [Caddy Integration](#caddy-integration--caddy-との連携)
- [Development](#development--開発)

---

## Quick Start / クイックスタート

```bash
# Install / インストール
npm install -g bunterm

# Start terminal in current directory / カレントディレクトリでターミナル起動
cd ~/my-project
bunterm up

# Open in browser / ブラウザで開く
# → http://localhost:7680/bunterm/my-project/

# Stop / 停止
bunterm down
```

That's it! No configuration needed for basic usage.

基本的な利用には設定不要です。

---

## Features / 機能

### Core Features / コア機能

| Feature | Description |
|---------|-------------|
| **Zero Config** | Just run `bunterm up` - no setup required / 設定不要で即起動 |
| **Native Terminal** | Powered by Bun.Terminal - no external dependencies / Bun.Terminal 使用、外部依存なし |
| **Block UI** | Warp-style command blocks with status indicators / Warp 風コマンドブロック |
| **AI Integration** | Built-in AI chat with multiple LLM support / 複数 LLM 対応の AI チャット |
| **File Transfer** | Upload/download files through browser / ブラウザ経由でファイル転送 |
| **Smart Clipboard** | Image paste, snippets, clipboard history / 画像ペースト、スニペット、履歴 |
| **HTML Preview** | Live preview with auto-reload / ライブプレビューと自動リロード |
| **Multi-Session** | Manage multiple terminals from one portal / ポータルで一元管理 |
| **tmux Optional** | Works without tmux (optional integration) / tmux なしで動作 |

### Mobile Features / モバイル機能

| Feature | Description |
|---------|-------------|
| **PWA Support** | Add to home screen, fullscreen mode / ホーム画面追加、フルスクリーン |
| **IME Input** | Japanese/CJK input support / 日本語入力対応 |
| **Touch Zoom** | Pinch to resize font / ピンチでフォントサイズ変更 |
| **Double-tap Enter** | Quick command execution / ダブルタップで Enter |
| **Scroll Buttons** | Easy scrollback navigation / スクロール用ボタン |
| **Push Notifications** | Bell alerts for remote monitoring / リモート監視用通知 |

### PC Features / PC 機能

| Feature | Description |
|---------|-------------|
| **Ctrl+Scroll Zoom** | Mouse wheel font resize / マウスホイールでサイズ変更 |
| **Trackpad Pinch** | Mac gesture support / Mac トラックパッド対応 |
| **Search** | Ctrl+Shift+F for scrollback search / スクロールバック内検索 |
| **Toolbar Toggle** | Ctrl+J to show/hide / Ctrl+J で表示切替 |

---

## Use Cases / ユースケース

### 1. AI Coding Assistant Monitoring / AI コーディングアシスタントの監視

Monitor long-running AI coding sessions (like Claude Code) from anywhere.

Claude Code などの AI コーディングセッションをどこからでも監視。

```bash
# On your server / サーバー上で
cd ~/my-ai-project
bunterm up

# Access from phone/tablet / スマホ・タブレットからアクセス
# https://your-server.com/bunterm/my-ai-project/
```

### 2. Remote Development / リモート開発

Access your development environment from any device with a browser.

ブラウザさえあればどのデバイスからでも開発環境にアクセス。

```bash
# Start multiple project terminals / 複数プロジェクトを起動
cd ~/project-a && bunterm up
cd ~/project-b && bunterm up

# List all sessions / セッション一覧
bunterm list --url
```

### 3. Server Administration / サーバー管理

Predefined sessions for server operations.

サーバー操作用の事前定義セッション。

```yaml
# ~/.config/bunterm/config.yaml
sessions:
  - name: logs
    dir: /var/log
  - name: docker
    dir: /opt/docker
```

```bash
bunterm daemon start --sessions
```

---

## Installation / インストール

```bash
# Install globally with npm
npm install -g bunterm

# Or run directly with bunx
bunx bunterm up
```

### Prerequisites / 必要な依存関係

- **Bun** 1.3.5+ (required / 必須)
- **tmux** (optional / オプション)

```bash
# Install Bun / Bun をインストール
curl -fsSL https://bun.sh/install | bash

# Check installation / インストール確認
bunterm doctor
```

**Note**: tmux is optional. bunterm works without it using Bun.Terminal.

**注意**: tmux はオプションです。bunterm は Bun.Terminal を使用して tmux なしで動作します。

---

## Usage / 使い方

### Dynamic Usage (Ad-hoc Sessions) / 動的利用

Start sessions on-demand in any directory. No configuration needed.

設定不要で、任意のディレクトリでその場でセッションを起動。

```bash
# Start in your project directory
cd ~/my-project
bunterm up

# Access in browser
# http://localhost:7680/bunterm/my-project/

# Check status
bunterm status

# List sessions with URLs
bunterm list --url

# Stop
bunterm down
```

### Static Usage (Predefined Sessions) / 静的利用

Define sessions in config.yaml and start them all at once.

```yaml
# ~/.config/bunterm/config.yaml
sessions:
  - name: project-a
    dir: /home/user/project-a
  - name: project-b
    dir: /home/user/project-b
```

```bash
# Start daemon + all predefined sessions
bunterm daemon start --sessions

# Stop daemon + all sessions
bunterm daemon stop --stop-sessions
```

---

## Commands / コマンド

### Session Commands / セッションコマンド

| Command | Description |
|---------|-------------|
| `bunterm up` | Start session for current directory / セッション起動 |
| `bunterm down` | Stop session for current directory / セッション停止 |
| `bunterm status` | Show daemon and session status / 状態表示 |
| `bunterm list` | List active sessions / セッション一覧 |
| `bunterm list --url` | List with access URLs / URL 表示 |
| `bunterm attach [name]` | Attach to tmux session (requires tmux) / tmux に接続 |

### Daemon Control / デーモン制御

| Command | Description |
|---------|-------------|
| `bunterm daemon start` | Start daemon only / デーモンのみ起動 |
| `bunterm daemon start --sessions` | Start daemon + all predefined sessions |
| `bunterm daemon stop` | Stop daemon / デーモン停止 |
| `bunterm daemon reload` | Reload config (hot-reload) / 設定リロード |
| `bunterm daemon restart` | Restart daemon / デーモン再起動 |

### Share Commands / 共有コマンド

| Command | Description |
|---------|-------------|
| `bunterm share` | Create read-only share link / 共有リンク作成 |
| `bunterm share list` | List active shares / 共有一覧 |
| `bunterm share revoke <token>` | Revoke a share / 取り消し |

### Utilities / ユーティリティ

| Command | Description |
|---------|-------------|
| `bunterm doctor` | Check dependencies and configuration / 診断 |

---

## Configuration / 設定

Configuration files are searched in the following order:

1. `./bunterm.yaml`
2. `./.bunterm.yaml`
3. `~/.config/bunterm/config.yaml`

### Example / 設定例

```yaml
# ~/.config/bunterm/config.yaml

# URL path prefix
base_path: /bunterm

# Daemon HTTP port
daemon_port: 7680

# Listen addresses (default: localhost only)
listen_addresses:
  - "127.0.0.1"
  - "::1"

# tmux mode: "none" (default), "auto", "attach", "new"
tmux_mode: none

# Toolbar settings
terminal_ui:
  font_size_default_mobile: 32
  font_size_default_pc: 14

# File transfer settings
file_transfer:
  enabled: true
  max_file_size: 104857600  # 100MB

# HTML preview settings
preview:
  enabled: true
  allowed_extensions:
    - .html
    - .htm
    - .md

# Predefined sessions
sessions:
  - name: project-a
    dir: /home/user/project-a
```

---

## Block UI / ブロック UI

bunterm features a Warp-style Block UI that visually groups commands and their outputs.

bunterm は Warp 風のブロック UI を搭載し、コマンドと出力を視覚的にグループ化します。

```
┌─ [running] ─────────────────────────────────────┐
│ $ npm test                                       │
│                                                  │
│ > project@1.0.0 test                             │
│ > jest                                           │
│                                                  │
│ PASS  src/utils.test.ts                          │
│ PASS  src/index.test.ts                          │
└─────────────────────────────────────────── [✓] ──┘
```

### Features / 機能

| Feature | Description |
|---------|-------------|
| **Visual Separation** | Each command is displayed as a distinct block |
| **Status Indicators** | Running (blue), Success (green), Error (red) |
| **Block Operations** | Copy, fold blocks individually |
| **AI Integration** | Analyze selected blocks with AI |

### Shell Integration / シェル統合

Block UI requires shell integration to detect command boundaries.

Add to your `~/.bashrc` or `~/.zshrc`:

```bash
# Bash
if [[ -n "$BUNTERM_NATIVE" ]]; then
  source "$(bunterm shell-integration bash)"
fi

# Zsh
if [[ -n "$BUNTERM_NATIVE" ]]; then
  source "$(bunterm shell-integration zsh)"
fi
```

The script only activates inside bunterm (checks `BUNTERM_NATIVE` env var), so it's safe to always include.

---

## AI Integration / AI 統合

bunterm includes built-in AI chat that can analyze terminal output and suggest commands.

bunterm は組み込みの AI チャットを搭載し、ターミナル出力を分析してコマンドを提案します。

### Supported LLMs / 対応 LLM

| LLM | Method | Description |
|-----|--------|-------------|
| **Claude** | Claude Code CLI | Uses your Claude Pro subscription |
| **Codex** | Codex CLI | OpenAI Codex CLI |
| **Gemini** | Gemini CLI | Google Gemini CLI |

### Features / 機能

- **Block Context**: Select command blocks to provide context to AI
- **Command Suggestions**: AI suggests next commands based on output
- **Risk Assessment**: Commands are flagged by risk level (safe/moderate/dangerous)
- **Caching**: Identical queries return cached results to save quota
- **Rate Limiting**: Prevents excessive API usage

### Claude Code Session Watcher / Claude Code セッション監視

bunterm can monitor Claude Code sessions and quote recent conversations:

- **Quote to Clipboard**: Copy recent Claude conversations to share with other AIs
- **Inline Blocks**: Display Claude turns as terminal blocks
- **Context Sync**: Automatically sync Claude's work to AI chat

---

## File Operations / ファイル操作

### File Browser / ファイルブラウザ

Browse, upload, and download files within your session directory.

セッションディレクトリ内のファイルを閲覧・アップロード・ダウンロード。

**Toolbar buttons:**
- 📥 Download: Browse and download files
- 📤 Upload: Upload files to current directory

### Security / セキュリティ

- Path traversal protection (cannot access files outside session directory)
- Configurable file size limits
- Optional extension whitelist

```yaml
file_transfer:
  enabled: true
  max_file_size: 104857600  # 100MB
  allowed_extensions: []     # Empty = all allowed
```

---

## Clipboard & Snippets / クリップボード & スニペット

### Paste Button / ペーストボタン

Quick paste from system clipboard to terminal.

### Smart Clipboard / スマートクリップボード

Automatically detects clipboard content type:

| Content | Action |
|---------|--------|
| Text | Send directly to terminal |
| Image | Show preview → Upload → Send file path |
| Multiple Images | Preview with navigation → Upload all |

**Keyboard shortcut:** `Ctrl+Shift+V` for smart paste (image-aware)

**Drag & Drop:** Drop images directly onto the terminal to upload.

### Snippet Manager / スニペットマネージャー

Save and reuse frequently used commands.

```
┌─────────────────────────────────────────┐
│ 📌 Snippets          [Import][Export][+]│
├─────────────────────────────────────────┤
│ [🔍 Search snippets...]                 │
├─────────────────────────────────────────┤
│ Docker Node               [▶][✎][🗑]    │
│ docker run -it node:latest              │
└─────────────────────────────────────────┘
```

- Add/Edit/Delete snippets
- Search by name or command
- Import/Export as JSON
- Run snippet directly

### Clipboard History / クリップボード履歴

Long-press the paste button to access clipboard history (last 10 items).

---

## HTML Preview / HTML プレビュー

Live preview HTML files with automatic reload on save.

HTML ファイルをライブプレビューし、保存時に自動リロード。

### Usage / 使い方

1. Click the 👁 (preview) button in toolbar
2. Select an HTML file from file browser
3. Preview pane opens on the right side
4. Edit and save the file - preview updates automatically

### Features / 機能

- **Split View**: Terminal and preview side by side
- **Resizable**: Drag to adjust preview width
- **Live Reload**: WebSocket-based file watching
- **Mobile Support**: Vertical split on mobile devices

### Configuration / 設定

```yaml
preview:
  enabled: true
  default_width: 400
  debounce_ms: 300
  allowed_extensions:
    - .html
    - .htm
```

---

## Notifications / 通知機能

Receive browser push notifications even when the tab is closed.

タブを閉じていてもブラウザのプッシュ通知を受け取れます。

**Setup / 設定:**
1. Click the bell icon (🔔) in the toolbar
2. Allow notifications when prompted
3. Notifications are sent on terminal bell (`\a`)

**Use case / 活用例:**
```bash
# Notify when command completes
long-running-command; echo -e '\a'
```

### Custom Triggers / カスタムトリガー

```yaml
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

```bash
# Share current session for 1 hour (default)
bunterm share

# Share for 24 hours
bunterm share --expires 24h

# List active shares
bunterm share list

# Revoke a share
bunterm share revoke <token>
```

Features:
- **Read-only**: Viewers can see but not interact
- **Time-limited**: Links expire automatically
- **Revocable**: Cancel access anytime

---

## PWA Support / PWA 対応

- **Fullscreen Mode**: No browser address bar
- **Home Screen Icon**: Add to home screen on iOS/Android
- **Auto Reconnect**: Reconnects when returning from background

---

## Caddy Integration / Caddy との連携

```bash
# Add route via Caddy Admin API
bunterm caddy setup --hostname example.com

# Or add to Caddyfile manually
bunterm caddy snippet
```

```caddyfile
handle /bunterm/* {
    reverse_proxy 127.0.0.1:7680
}
```

---

## File Structure / ファイル構成

```
~/.config/bunterm/
  config.yaml           # Configuration file

~/.local/state/bunterm/
  state.json            # Running session state
  bunterm.sock          # Daemon communication socket
```

---

## Keyboard Shortcuts / キーボードショートカット

| Shortcut | Action |
|----------|--------|
| `Ctrl+J` | Toggle toolbar |
| `Ctrl+Shift+F` | Open search |
| `Ctrl+Shift+V` | Smart paste (image-aware) |
| `Escape` | Close modal/search |

---

## Development / 開発

```bash
# Clone repository
git clone https://github.com/cuzic/bunterm.git
cd bunterm

# Install dependencies
bun install

# Run in development
bun run src/index.ts <command>

# Test
bun test

# Type check
bun run typecheck

# Build
bun run build
```

See [CLAUDE.md](CLAUDE.md) for development guidelines.

---

## License / ライセンス

MIT
