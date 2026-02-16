# ttyd-mux

ttyd session multiplexer - 複数の ttyd+tmux セッションを管理するCLIツール

## 概要

ttyd-mux は、複数の Web ターミナル（ttyd）セッションを簡単に管理するためのツールです。

- カレントディレクトリで `ttyd-mux up` するだけでブラウザアクセス可能なターミナルを起動
- 複数セッションを一元管理するポータルページを提供
- Caddy などのリバースプロキシと連携して外部公開

## インストール

```bash
# npm でグローバルインストール
npm install -g ttyd-mux

# または npx で直接実行
npx ttyd-mux up
```

### 必要な依存関係

- **Node.js** 18 以上（または Bun）
- **ttyd**: https://github.com/tsl0922/ttyd
- **tmux**: ターミナルマルチプレクサ

```bash
# Ubuntu/Debian
sudo apt install ttyd tmux

# macOS (Homebrew)
brew install ttyd tmux
```

## クイックスタート

```bash
# プロジェクトディレクトリで起動
cd ~/my-project
ttyd-mux up

# ブラウザでアクセス
# http://localhost:7680/ttyd-mux/my-project/

# 状態確認
ttyd-mux status

# 停止
ttyd-mux down
```

## コマンド

### メインコマンド

```bash
ttyd-mux up [--name <name>]     # セッション起動 → 自動アタッチ
ttyd-mux up --detach            # セッション起動のみ（アタッチしない）
ttyd-mux down                   # カレントディレクトリのセッション停止
```

### セッション管理

```bash
ttyd-mux start <name>           # 事前定義セッションを起動
ttyd-mux start --all            # 全ての事前定義セッションを起動
ttyd-mux stop <name>            # セッション停止
ttyd-mux stop --all             # 全セッション停止
ttyd-mux status                 # 状態表示
```

### 直接アクセス

```bash
ttyd-mux attach [name]          # tmuxセッションに直接アタッチ
```

### デーモン制御

```bash
ttyd-mux daemon                 # デーモン起動
ttyd-mux daemon -f              # フォアグラウンドで起動（デバッグ用）
ttyd-mux shutdown               # デーモン終了
```

### 設定生成

```bash
ttyd-mux generate caddy         # Caddyfile生成
ttyd-mux generate caddy -o Caddyfile --hostname example.com
```

## 設定

設定ファイルは以下の順序で検索されます：

1. `./ttyd-mux.yaml`
2. `./.ttyd-mux.yaml`
3. `~/.config/ttyd-mux/config.yaml`

### 設定例

```yaml
# ~/.config/ttyd-mux/config.yaml

# URLパスのプレフィックス
base_path: /ttyd-mux

# ttydセッションのベースポート
base_port: 7600

# デーモンのHTTPポート
daemon_port: 7680

# リッスンアドレス（デフォルト: IPv4 + IPv6 localhost）
listen_addresses:
  - "127.0.0.1"
  - "::1"
  # - "0.0.0.0"  # 外部からのアクセスを許可する場合

# セッション起動時に自動でtmuxにアタッチ（デフォルト: true）
auto_attach: true

# 事前定義セッション（オプション）
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

## アーキテクチャ

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

- **Caddy**: 外部からのリクエストを ttyd-mux に転送
- **ttyd-mux daemon**: ポータル表示 + ttyd へのリバースプロキシ
- **ttyd**: 各セッションの Web ターミナル（tmux を起動）

## Caddy との連携

### Admin API で設定（推奨）

```bash
# ルートを追加
ttyd-mux caddy setup --hostname example.com

# 設定を確認
ttyd-mux caddy status

# ルートを削除
ttyd-mux caddy remove --hostname example.com
```

### Caddyfile 手動編集

```bash
# コピペ用スニペットを表示
ttyd-mux caddy snippet
```

```caddyfile
handle /ttyd-mux/* {
    reverse_proxy 127.0.0.1:7680
}
```

詳細は [docs/caddy-setup.md](docs/caddy-setup.md) を参照。

## ファイル構成

```
~/.config/ttyd-mux/
  config.yaml           # 設定ファイル

~/.local/state/ttyd-mux/
  state.json            # 実行中セッションの状態
  ttyd-mux.sock         # デーモン通信用ソケット
```

## 開発

```bash
# 開発実行
bun run src/index.ts <command>

# テスト
bun test

# 型チェック
bun run typecheck

# リント
bun run check

# ビルド（単一実行ファイル）
bun build src/index.ts --compile --outfile ttyd-mux
```

## ライセンス

MIT
