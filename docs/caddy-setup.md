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

## 外部公開時の認証設定（Google OAuth）

インターネットから ttyd-mux にアクセスする場合は、OAuth 認証の設定を強く推奨します。

### 1. Caddy に caddy-security プラグインを追加

標準の Caddy には OAuth 機能がないため、`caddy-security` プラグインを含めてビルドする必要があります。

```bash
# Go のインストール（未インストールの場合）
# Ubuntu: sudo apt install golang
# macOS: brew install go

# xcaddy のインストール
go install github.com/caddyserver/xcaddy/cmd/xcaddy@latest

# caddy-security 付きでビルド
~/go/bin/xcaddy build --with github.com/greenpau/caddy-security

# モジュール確認
./caddy list-modules | grep -i security

# インストール
sudo mv /usr/bin/caddy /usr/bin/caddy.bak
sudo mv ./caddy /usr/bin/caddy
sudo systemctl restart caddy
```

### 2. Google OAuth の設定

[Google Cloud Console](https://console.cloud.google.com/) で OAuth クライアントを作成：

1. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**
2. **Application type**: Web application
3. **Authorized redirect URIs**: `https://your-domain.com/oauth2/google`
4. Client ID と Client Secret を取得

### 3. secrets.env の作成

```bash
# /etc/caddy/secrets.env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

```bash
sudo chmod 600 /etc/caddy/secrets.env
sudo chown caddy:caddy /etc/caddy/secrets.env
```

### 4. systemd override の設定

Caddy が secrets.env を読み込むように設定：

```bash
sudo mkdir -p /etc/systemd/system/caddy.service.d
cat << 'EOF' | sudo tee /etc/systemd/system/caddy.service.d/override.conf
[Service]
EnvironmentFile=/etc/caddy/secrets.env
EOF

sudo systemctl daemon-reload
```

### 5. Caddyfile の設定

```caddyfile
{
    order authenticate before respond
    order authorize before basicauth

    security {
        # Google OAuth プロバイダー
        oauth identity provider google {
            realm google
            driver google
            client_id {$GOOGLE_CLIENT_ID}
            client_secret {$GOOGLE_CLIENT_SECRET}
            scopes openid email profile
        }

        # 認証ポータル
        authentication portal myportal {
            crypto default token lifetime 3600
            enable identity provider google
            cookie domain your-domain.com
            cookie lifetime 86400

            # 許可するユーザーを指定
            transform user {
                match email your-email@gmail.com
                action add role authp/user
            }
        }

        # 認可ポリシー
        authorization policy mypolicy {
            set auth url https://your-domain.com/oauth2/google
            allow roles authp/user
        }
    }
}

your-domain.com {
    log {
        output stdout
        format json
    }

    # 信頼する IP アドレス（認証をスキップ）
    @trusted {
        remote_ip 127.0.0.1 ::1
        # 他の信頼する IP を追加
        # remote_ip 192.168.1.0/24
    }

    # 信頼しない IP からのアクセス
    @untrusted {
        not remote_ip 127.0.0.1 ::1
    }

    # OAuth コールバック
    handle /oauth2/* {
        authenticate with myportal
    }

    # ttyd-mux（認証付き）
    handle /ttyd-mux/* {
        authorize @untrusted with mypolicy
        reverse_proxy 127.0.0.1:7680
    }

    # その他（認証付き）
    handle {
        authorize @untrusted with mypolicy
        root * /usr/share/caddy
        file_server
    }
}
```

### 6. 設定の反映

```bash
sudo systemctl restart caddy
```

### 動作確認

1. ブラウザで `https://your-domain.com/ttyd-mux/` にアクセス
2. Google ログイン画面にリダイレクト
3. 許可されたメールアドレスでログイン
4. ttyd-mux ポータルにアクセス可能

### IP ベースの信頼設定

特定の IP アドレスからのアクセスは認証をスキップできます：

```caddyfile
@trusted {
    remote_ip 127.0.0.1 ::1 192.168.1.0/24
}

@untrusted {
    not remote_ip 127.0.0.1 ::1 192.168.1.0/24
}

handle /ttyd-mux/* {
    # @trusted は認証なしでアクセス可能
    authorize @untrusted with mypolicy
    reverse_proxy 127.0.0.1:7680
}
```

## 参考リンク

- [Caddy ドキュメント](https://caddyserver.com/docs/)
- [Caddy Admin API](https://caddyserver.com/docs/api)
- [caddy-security プラグイン](https://github.com/greenpau/caddy-security)
- [xcaddy (Caddy ビルドツール)](https://github.com/caddyserver/xcaddy)
- [ttyd](https://github.com/tsl0922/ttyd)
