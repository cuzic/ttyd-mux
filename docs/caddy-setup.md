# Caddy との連携設定

ttyd-mux を Caddy リバースプロキシで外部公開するための設定手順です。

## 前提条件

- Caddy がインストール済み
- ttyd-mux が動作している
- ドメイン名（例: `example.com`）が設定済み

## プロキシモード

ttyd-mux には2つのプロキシモードがあります：

### Proxy モード（デフォルト）

```
インターネット → Caddy (:443) → ttyd-mux daemon (:7680) → ttyd (:7601, :7602, ...)
```

- 全てのトラフィックが ttyd-mux daemon を経由
- IME ヘルパー（モバイル日本語入力対応）が利用可能
- 設定がシンプル

### Static モード

```
インターネット → Caddy (:443) → ttyd (:7601, :7602, ...) 直接
                     ↓
              静的ポータル HTML
```

- Caddy から ttyd に直接ルーティング
- 低レイテンシ（中間プロキシなし）
- デーモン常駐不要（セッション管理時のみ使用）
- IME ヘルパーは利用不可

## 設定ファイル

```yaml
# ~/.config/ttyd-mux/config.yaml

# プロキシモード: "proxy"（デフォルト）または "static"
proxy_mode: proxy

# Caddy 連携用のホスト名（--hostname オプションのデフォルト値）
hostname: example.com

# Caddy Admin API URL
caddy_admin_api: http://localhost:2019
```

## 設定方法

### 方法1: Caddy Admin API（推奨）

Caddy の Admin API を使って動的に設定を追加する方法です。

```bash
# ルートを追加
ttyd-mux caddy setup --hostname example.com

# 設定を確認
ttyd-mux caddy status

# ルートを削除
ttyd-mux caddy remove --hostname example.com
```

**オプション:**

| オプション | 説明 | デフォルト |
|-----------|------|-----------|
| `--hostname` | サーバーのホスト名（必須） | - |
| `--admin-api` | Caddy Admin API の URL | `http://localhost:2019` |
| `-c, --config` | ttyd-mux 設定ファイルのパス | 自動検出 |

**例:**

```bash
# カスタム Admin API アドレスを指定
ttyd-mux caddy setup --hostname example.com --admin-api http://127.0.0.1:2019
```

### 方法2: Caddyfile 手動編集

Caddyfile を直接編集する場合は、以下のスニペットを追加してください。

```bash
# コピペ用のスニペットを表示
ttyd-mux caddy snippet
```

**出力例:**

```caddyfile
# Add this to your Caddyfile inside your site block:

handle /ttyd-mux/* {
    reverse_proxy 127.0.0.1:7680
}
```

既存の Caddyfile に追加：

```caddyfile
# /etc/caddy/Caddyfile

example.com {
    # 既存の設定...
    handle / {
        root * /var/www/html
        file_server
    }

    # ttyd-mux を追加（既存のブロック内に追記）
    handle /ttyd-mux/* {
        reverse_proxy 127.0.0.1:7680
    }
}
```

設定を反映：

```bash
sudo systemctl reload caddy
# または
sudo caddy reload --config /etc/caddy/Caddyfile
```

**注意:** Caddy では同じホスト名のブロックは1箇所にまとめる必要があります。

## 動作確認

```bash
# ローカルでセッションを起動
cd ~/my-project
ttyd-mux up

# ブラウザでアクセス
# https://example.com/ttyd-mux/my-project/

# ステータス確認
ttyd-mux status
```

## Admin API について

Caddy は標準で Admin API（デフォルト `:2019`）を持っています。

### Admin API の有効化

通常はデフォルトで有効ですが、無効にしている場合は Caddyfile に追加：

```caddyfile
{
    admin localhost:2019
}
```

### セキュリティ

Admin API は localhost のみでリッスンするため、外部からはアクセスできません。
リモートから管理する場合は SSH トンネルなどを使用してください。

```bash
# SSH トンネル経由で Admin API にアクセス
ssh -L 2019:localhost:2019 user@example.com
ttyd-mux caddy status --admin-api http://localhost:2019
```

## 認証の追加（オプション）

Basic 認証を追加する場合（Caddyfile）：

```caddyfile
handle /ttyd-mux/* {
    basicauth {
        # caddy hash-password でハッシュを生成
        user $2a$14$...hashed_password...
    }
    reverse_proxy 127.0.0.1:7680
}
```

## Static モードの設定

Static モードでは、静的ポータルと Caddyfile スニペットを生成して使用します。

### 1. 設定ファイルの準備

```yaml
# ~/.config/ttyd-mux/config.yaml
proxy_mode: static
hostname: example.com
```

### 2. セッションを起動

```bash
cd ~/my-project
ttyd-mux up --detach
```

### 3. デプロイファイルを生成

```bash
ttyd-mux deploy
```

生成されるファイル：

```
~/.local/share/ttyd-mux/deploy/
├── portal/
│   └── index.html          # 静的ポータルページ
├── Caddyfile.snippet        # Caddyfile 用スニペット
├── caddy-routes.json        # Caddy Admin API 用 JSON
└── deploy.sh                # セットアップスクリプト
```

### 4. Caddyfile に追加

```bash
cat ~/.local/share/ttyd-mux/deploy/Caddyfile.snippet
```

出力例：

```caddyfile
# ttyd-mux static mode configuration for example.com

# Portal page (static HTML)
handle /ttyd-mux {
    rewrite * /index.html
    root * /home/user/.local/share/ttyd-mux/deploy/portal
    file_server
}

handle /ttyd-mux/ {
    rewrite * /index.html
    root * /home/user/.local/share/ttyd-mux/deploy/portal
    file_server
}

# Session: my-project
handle /ttyd-mux/my-project/* {
    reverse_proxy localhost:7601
}
```

### 5. セッション変更後の更新

セッションを追加/削除した後は、再度デプロイを実行：

```bash
ttyd-mux up      # 新しいセッションを起動
ttyd-mux deploy  # ファイルを再生成
```

または Caddy Admin API 経由で同期：

```bash
ttyd-mux caddy sync
```

### deploy コマンドオプション

| オプション | 説明 | デフォルト |
|-----------|------|-----------|
| `--hostname` | サーバーのホスト名 | config.yaml の hostname |
| `-o, --output` | 出力ディレクトリ | `~/.local/share/ttyd-mux/deploy` |
| `-c, --config` | 設定ファイルのパス | 自動検出 |

### caddy sync コマンド

Static モードで Caddy のルートを現在のセッション状態に同期：

```bash
ttyd-mux caddy sync --hostname example.com
```

**動作:**
1. 現在のセッション一覧を取得
2. Caddy の既存ルートと比較
3. 追加/削除されたセッションのルートを更新

## トラブルシューティング

### Admin API に接続できない

```
Error: Cannot connect to Caddy Admin API at http://localhost:2019
```

1. Caddy が起動しているか確認：
   ```bash
   systemctl status caddy
   ```

2. Admin API が有効か確認：
   ```bash
   curl http://localhost:2019/config/
   ```

### WebSocket 接続エラー

1. ブラウザの開発者ツールでネットワークタブを確認
2. WebSocket 接続が `wss://` になっているか確認

### ターミナルが表示されない

1. ttyd-mux daemon が起動しているか確認：
   ```bash
   ttyd-mux status
   ```

2. 直接 daemon にアクセスして動作確認：
   ```bash
   curl http://127.0.0.1:7680/ttyd-mux/
   ```

## セキュリティ考慮事項

1. **認証必須**: 本番環境では必ず認証を設定してください
2. **HTTPS 使用**: Caddy は自動で Let's Encrypt 証明書を取得します
3. **ファイアウォール**: 7680, 7600-7699 ポートは localhost のみに制限
4. **セッション分離**: 各ユーザーに異なるセッションを割り当て

## 参考リンク

- [Caddy Admin API ドキュメント](https://caddyserver.com/docs/api)
- [Caddy ドキュメント](https://caddyserver.com/docs/)
- [ttyd GitHub](https://github.com/tsl0922/ttyd)
