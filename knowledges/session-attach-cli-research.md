# 既存セッションにアタッチするCLI - 要素技術調査

## 概要

ターミナルセッションへのアタッチを実現するための要素技術をまとめる。

---

## 1. PTY（疑似端末）の基礎

### PTYとは
- **Pseudoterminal (PTY)**: 双方向通信チャネルを提供する仮想キャラクタデバイスのペア
- **Master/Slave構成**: マスター側が制御、スレーブ側がプログラムに接続
- スレーブ側は従来のターミナルと同一のインターフェースを提供

### Linuxでの実装
- **UNIX 98 pseudoterminals** (System V-style): Linux 2.6.4以降の標準
- `/dev/ptmx`: 疑似端末マスターマルチプレクサ
- BSD-styleは非推奨

### 参考リンク
- [pty(7) - Linux manual page](https://www.man7.org/linux/man-pages/man7/pty.7.html)
- [Linux PTY - Docker attach/execの仕組み](https://iximiuz.com/en/posts/linux-pty-what-powers-docker-attach-functionality/)

---

## 2. reptyr - プロセスを新しいターミナルにアタッチ

### 概要
既存の実行中プロセスを新しいターミナルにアタッチするユーティリティ。

### 実装方式
1. `ptrace(2)` でターゲットプロセスにアタッチ
2. 新しいターミナルを開く
3. `dup2` で古いファイルディスクリプタを新しいものに置き換え
4. **制御端末の変更** - これが他ツールとの最大の差別化ポイント
   - `^C`, `^Z`, ウィンドウリサイズが正しく動作

### TTY-Stealingモード (-T)
- ptraceを使わない代替モード
- PTYのマスター側を「盗む」
- より信頼性が高く柔軟
- TTY上の全プロセスにアタッチ可能

### 制限事項
- Ubuntu Maverick以降ではptrace能力がデフォルト無効
- 子プロセスを持つプロセスへのアタッチは問題あり
- epoll使用アプリ（rtorrentなど）は正しく動作しない

### 参考リンク
- [GitHub - nelhage/reptyr](https://github.com/nelhage/reptyr)
- [reptyr: Attach a running process to a new terminal](https://blog.nelhage.com/2011/01/reptyr-attach-a-running-process-to-a-new-terminal/)

---

## 3. tmux - プログラマティック制御

### Control Mode (`tmux -C`)
- stdin/stdout経由でコマンド送受信
- 外部プログラムとの統合に最適
- イベント通知: セッション変更、ウィンドウ作成、ペイン出力など

### Python API - libtmux
```python
import libtmux

server = libtmux.Server()
session = server.sessions.get(session_name="demo")
pane = session.active_window.active_pane
pane.send_keys("echo 'hello from libtmux'", enter=True)
```

### 主要コマンド
- `tmux attach-session -t <session>`: セッションにアタッチ
- `tmux new-session -A -s <name>`: セッション作成/アタッチ（存在すればアタッチ）
- `-d`: 他のクライアントをデタッチ

### 参考リンク
- [tmux(1) - Linux manual page](https://man7.org/linux/man-pages/man1/tmux.1.html)
- [libtmux - Python API](https://github.com/tmux-python/libtmux)
- [tmux control mode](https://tmuxai.dev/tmux-control-mode/)

---

## 4. 言語別PTYライブラリ

### Rust

#### portable-pty (推奨)
- WezTermで使用される成熟したクレート
- クロスプラットフォーム対応
- ランタイムで実装を選択可能
- https://lib.rs/crates/portable-pty

#### pseudoterminal
- 同期・非同期両対応（非同期は未実装）
- Windows (ConPTY) / Unix両対応
- MITライセンス
- https://crates.io/crates/pseudoterminal

### Node.js

#### node-pty (Microsoft)
- Linux, macOS, Windows対応
- Windows: ConPTY (1809+) / winpty
- xterm.jsとの組み合わせでターミナルエミュレータ実装
- 注意: スレッドセーフではない
- https://github.com/microsoft/node-pty

#### stmux
- Node.js用シンプルターミナルマルチプレクサ
- Blessed + xterm.js + node-pty
- エラー検出・通知機能内蔵
- https://github.com/rse/stmux

---

## 5. Unix Domain Socket によるセッション共有

### 基本概念
- 同一ホスト上のプロセス間通信（IPC）
- TCP/IPループバックより効率的かつセキュア
- ファイルディスクリプタの受け渡しが可能（sendmsg/recvmsg）

### マルチユーザー共有
- 共有ディレクトリにソケットファイル作成
- sticky bitで複数ユーザーがアクセス可能

### 実装パターン
1. リスナープロセスがソケットを作成・待機
2. クライアントがソケットファイルに接続
3. 接続確立後、双方向通信開始

### 参考リンク
- [unix(7) - Linux manual page](https://man7.org/linux/man-pages/man7/unix.7.html)
- [Getting Started With Unix Domain Sockets](https://medium.com/swlh/getting-started-with-unix-domain-sockets-4472c0db4eb1)

---

## 6. tmate - インスタントターミナル共有

### アーキテクチャ
- tmuxのフォーク + リモート接続機能
- libssh経由でtmate.ioサーバーにSSH接続
- 150-bit セッショントークン生成

### データフロー
```
[ホスト] <-- SSH --> [tmate daemon] <-- replication --> [proxy]
                                                            |
                                                      [WebSocket]
                                                            |
                                                    [HTML5 clients]
```

### 地理的分散
- San Francisco, New York, London, Singapore
- 複数IPに解決 → 最も応答性の良いサーバーを使用

### イベントソーシング
- Publisher → データバス → Subscriber
- 高可用性・スケーラブル・低レイテンシ

### 参考リンク
- [tmate.io](https://tmate.io/)
- [tmate paper (PDF)](https://viennot.com/tmate.pdf)
- [tmate-ssh-server](https://github.com/tmate-io/tmate-ssh-server)

---

## 7. upterm - Go製セキュアターミナル共有

### 特徴
- Go言語で実装（tmateはC言語）
- フォークではなく独自設計
- CLIとサーバー（uptermd）が単一バイナリ

### アーキテクチャ
```
[Host Machine]
     |
  [sshd (upterm)]
     |
  [Reverse SSH Tunnel]
     |
[uptermd server] <-- ssh / WebSocket -- [Clients]
```

### 動作原理
1. ホストマシンでSSHサーバー（sshd）を起動
2. uptermサーバーへリバースSSHトンネル確立
3. クライアントはuptermd経由でSSH or WebSocketで接続

### デプロイ
- Kubernetes対応
- Fly.io推奨（無料枠あり）
- 公式コミュニティサーバーはFly.ioでホスト

### 参考リンク
- [upterm.dev](https://upterm.dev/)
- [GitHub - owenthereal/upterm](https://github.com/owenthereal/upterm)

---

## 8. 実装アプローチの選択肢

### ローカルセッションアタッチ
| 方式 | 複雑度 | 利点 | 欠点 |
|------|--------|------|------|
| tmux control mode | 低 | 標準的、安定 | tmux依存 |
| reptyr | 中 | 既存プロセス対応 | ptrace制限 |
| Unix socket + PTY | 高 | 柔軟性高い | 実装コスト大 |

### リモートセッション共有
| 方式 | 複雑度 | 利点 | 欠点 |
|------|--------|------|------|
| tmate | 低 | 実績あり | Cで拡張困難 |
| upterm | 中 | Go製、拡張容易 | 比較的新しい |
| 自前SSH tunnel | 高 | 完全カスタマイズ | 実装コスト大 |

---

## 9. 推奨技術スタック

### Rust実装の場合
```
portable-pty + tokio + Unix socket
```

### Go実装の場合
```
creack/pty + golang.org/x/crypto/ssh + Unix socket
```

### Node.js実装の場合
```
node-pty + xterm.js + WebSocket
```

---

## 10. 次のステップ

1. 要件定義: ローカル/リモート、対象プロセス種別
2. 言語選択: Rust/Go/Node.js
3. プロトタイプ: tmux control mode での PoC
4. 独自実装: 必要に応じてPTY直接操作
