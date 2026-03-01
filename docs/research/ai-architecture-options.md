# AI 機能実装のためのアーキテクチャ調査

調査日: 2026-03-01

## 概要

ttyd-mux に Warp 風の AI 機能を実装するにあたり、現在の ttyd ベースのアーキテクチャが適切か、あるいは別のアプローチが必要かを調査した。

## AI 機能に必要な技術要件

| 機能 | 必要な能力 |
|------|-----------|
| `#` で自然言語→コマンド | 入力のインターセプト、コマンド注入 |
| エラー説明 | 出力の監視、exit code 検知 |
| コマンド修正 | 出力の監視、コマンド注入 |
| Next Command 予測 | コマンド履歴、コンテキスト分析 |
| Agent Mode | ターミナルバッファの読み取り、フロー制御 |

### 詳細要件

1. **入力インターセプト**: ユーザー入力を途中で捕捉・変換
2. **出力監視**: ターミナル出力をリアルタイムで分析
3. **コマンド注入**: AI が生成したコマンドをターミナルに送信
4. **ターミナル状態取得**: 現在の画面バッファ内容を取得
5. **フロー制御**: 出力の一時停止・再開

## 現在のアーキテクチャ

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  xterm.js + terminal-ui.js                              │   │
│  │  - 入力をキャプチャ (InputHandler)                       │   │
│  │  - 出力を表示                                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │ WebSocket                            │
└──────────────────────────┼──────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────┐
│  ttyd-mux daemon         │                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ws-proxy.ts                                            │   │
│  │  - WebSocket 中継                                       │   │
│  │  - 入出力メッセージ検査 (isInputMessage, isOutputMessage)│   │
│  │  - 通知パターンマッチング (processOutput)                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │ WebSocket                            │
└──────────────────────────┼──────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────┐
│  ttyd (C プロセス)        │                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  libwebsockets + libuv                                  │   │
│  │  - WebSocket サーバー                                    │   │
│  │  - PTY 管理                                             │   │
│  │  - バイナリプロトコル処理                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │ PTY                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  tmux / bash / etc.                                     │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### ttyd プロトコル

バイナリ WebSocket メッセージ、先頭バイトがコマンド種別:

| コード | 方向 | 意味 |
|--------|------|------|
| `0x30` ('0') | Client→Server | 入力データ |
| `0x31` ('1') | Server→Client | 出力データ |
| `0x32` ('2') | Client→Server | リサイズ (JSON: {cols, rows}) |
| `0x33` ('3') | Server→Client | ウィンドウタイトル設定 |
| `0x34` ('4') | Server→Client | 設定 (JSON) |
| `0x35` ('5') | Client→Server | 一時停止 |
| `0x36` ('6') | Client→Server | 再開 |
| `0x37` ('7') | Client→Server | JSON データ (初期化) |

### 現在の能力

| 能力 | 状態 | 備考 |
|------|------|------|
| 入力インターセプト | ✅ 可能 | ws-proxy で isInputMessage() |
| 出力監視 | ✅ 可能 | ws-proxy で processOutput() |
| コマンド注入 | ⚠️ 部分的 | クライアント側から可能 |
| ターミナル状態取得 | ❌ 不可 | ttyd にバッファ API なし |
| フロー制御 | ⚠️ 部分的 | pause/resume はあるが限定的 |

## アーキテクチャ選択肢

### Option A: 現状維持 + クライアント側拡張

**アプローチ**: ttyd をそのまま使い、クライアント側 (terminal-ui.js) で AI 機能を実装

```
Browser                     ttyd-mux                    ttyd
┌──────────────────┐       ┌──────────────────┐       ┌──────────┐
│ xterm.js         │       │ ws-proxy         │       │ PTY      │
│ + AI UI          │◄─────►│ (中継のみ)       │◄─────►│          │
│ + LLM API呼び出し │       │                  │       │          │
└──────────────────┘       └──────────────────┘       └──────────┘
       │
       ▼ HTTP/HTTPS
┌──────────────────┐
│ LLM API          │
│ (Anthropic等)    │
└──────────────────┘
```

**実装方法**:
- `InputHandler.ts` で `#` 入力を検知
- ブラウザから直接 LLM API を呼び出し (BYOK)
- xterm.js の `serialize` addon でバッファ取得
- 生成されたコマンドを WebSocket 経由で送信

**メリット**:
- 最小限の変更で実装可能
- ttyd の安定性をそのまま活用
- クライアント側で完結 (サーバー負荷なし)

**デメリット**:
- API キーがブラウザに露出 (セキュリティ懸念)
- サーバー側での一元管理が難しい
- Agent Mode の実装が困難

**適合度**: ★★★☆☆ (基本機能には十分)

---

### Option B: サーバーサイド AI + プロキシ拡張

**アプローチ**: ttyd-mux daemon で AI 処理を行い、プロキシ層で入出力を変換

```
Browser                     ttyd-mux                    ttyd
┌──────────────────┐       ┌──────────────────┐       ┌──────────┐
│ xterm.js         │       │ ws-proxy         │       │ PTY      │
│ + AI UI          │◄─────►│ + AI Interceptor │◄─────►│          │
│                  │       │ + Output Buffer  │       │          │
└──────────────────┘       │ + LLM Client     │       └──────────┘
                           └────────┬─────────┘
                                    │
                                    ▼
                           ┌──────────────────┐
                           │ LLM API          │
                           └──────────────────┘
```

**実装方法**:
- ws-proxy でメッセージをインターセプト
- 入力の `#` プレフィックスを検知
- サーバー側で LLM API を呼び出し
- 結果をクライアントに返すか、直接 ttyd に注入
- 出力バッファをサーバー側で保持

**メリット**:
- API キーをサーバーで安全に管理
- 複数クライアント間で状態共有可能
- より高度な AI 機能を実装可能

**デメリット**:
- ターミナル状態は出力ストリームから再構築が必要
- ttyd との同期が複雑
- サーバー負荷増加

**適合度**: ★★★★☆ (バランスが良い)

---

### Option C: ttyd 置換 (Bun.Terminal)

**アプローチ**: ttyd を廃止し、Bun の組み込み Terminal API で PTY を直接管理

```
Browser                     ttyd-mux
┌──────────────────┐       ┌──────────────────────────────────────┐
│ xterm.js         │       │ WebSocket Server                     │
│ + AI UI          │◄─────►│ + Bun.Terminal (PTY)                 │
│                  │       │ + Terminal State Manager             │
└──────────────────┘       │ + AI Processor                       │
                           │ + LLM Client                         │
                           └──────────────────────────────────────┘
                                    │
                                    ▼
                           ┌──────────────────┐
                           │ LLM API          │
                           └──────────────────┘
```

**実装方法**:
```typescript
// Bun.Terminal API の例
const terminal = new Bun.Terminal({
  cols: 80,
  rows: 24,
  data(term, data) {
    // 出力をクライアントに送信
    ws.send(Buffer.concat([Buffer.from([0x31]), data]));
    // AI 用にバッファに蓄積
    outputBuffer.append(data);
  }
});

const proc = Bun.spawn(["tmux", "new", "-A", "-s", sessionName], { terminal });

// クライアントからの入力
ws.on('message', (data) => {
  if (data[0] === 0x30) { // INPUT
    const input = data.slice(1).toString();
    if (input.startsWith('#')) {
      // AI コマンド処理
      handleAiCommand(input.slice(1), terminal);
    } else {
      terminal.write(input);
    }
  }
});
```

**メリット**:
- PTY を完全に制御可能
- ターミナル状態に直接アクセス
- Agent Mode を含む全機能が実装可能
- 単一プロセス (ttyd 起動不要)
- 遅延が最小化

**デメリット**:
- xterm.js との通信プロトコルを自前実装
- ttyd の機能 (ZMODEM, 認証など) を再実装
- POSIX のみ (Windows 非対応)
- 開発工数が大きい

**適合度**: ★★★★★ (最も柔軟だが工数大)

---

### Option D: ttyd フォーク/拡張

**アプローチ**: ttyd をフォークして AI 用の拡張プロトコルを追加

**追加するコマンド例**:
| コード | 方向 | 意味 |
|--------|------|------|
| `0x40` ('A') | Server→Client | ターミナルバッファ全体 |
| `0x41` ('B') | Client→Server | バッファ要求 |
| `0x42` ('C') | Server→Client | カーソル位置 |

**メリット**:
- ttyd の安定性を維持
- 必要な機能だけ追加

**デメリット**:
- C コードのメンテナンス負担
- アップストリームとの乖離
- ビルド環境の複雑化

**適合度**: ★★☆☆☆ (メンテナンス負担大)

---

## 技術詳細

### Bun.Terminal API (v1.3.5+)

```typescript
// 基本的な使用方法
const proc = Bun.spawn(["bash"], {
  terminal: {
    cols: 80,
    rows: 24,
    data(terminal, data) {
      // PTY からの出力
      process.stdout.write(data);
    },
  },
});

// メソッド
proc.terminal.write(data);      // 入力を送信
proc.terminal.resize(cols, rows); // サイズ変更
proc.terminal.setRawMode(true);   // Raw モード
proc.terminal.close();            // クローズ
```

**制限**: POSIX のみ (Linux, macOS)。Windows は未対応。

### xterm.js Serialize Addon

```typescript
import { Terminal } from "@xterm/xterm";
import { SerializeAddon } from "@xterm/addon-serialize";

const terminal = new Terminal();
const serializeAddon = new SerializeAddon();
terminal.loadAddon(serializeAddon);

// ターミナル内容を取得
const content = serializeAddon.serialize();
// または HTML として
const html = serializeAddon.serializeAsHTML();
```

**用途**: クライアント側でターミナル状態を AI に送信する際に使用。

### xterm.js Buffer API

```typescript
const buffer = terminal.buffer.active;
const line = buffer.getLine(buffer.cursorY);
const text = line?.translateToString() ?? '';
```

**用途**: 現在行やカーソル位置の取得。

## 推奨アプローチ

### Phase 1: Option B (サーバーサイド AI)

**理由**:
- 現在のアーキテクチャを大きく変えずに実装可能
- API キーのセキュアな管理
- 基本的な AI 機能 (`#` コマンド、エラー説明) に十分

**実装範囲**:
1. ws-proxy に AI インターセプター追加
2. サーバー側 LLM クライアント実装
3. 出力バッファ管理
4. クライアント UI (AI 提案表示)

### Phase 2: Option C への段階的移行 (将来)

**理由**:
- Agent Mode には PTY の完全制御が必要
- 長期的にはより柔軟なアーキテクチャ

**移行ステップ**:
1. Bun.Terminal で新規セッション作成をサポート
2. 既存 ttyd セッションと並行運用
3. 機能が安定したら ttyd を段階的に廃止

## 結論

| 機能 | Option A | Option B | Option C |
|------|----------|----------|----------|
| `#` コマンド | ○ | ◎ | ◎ |
| エラー説明 | ○ | ◎ | ◎ |
| コマンド修正 | ○ | ○ | ◎ |
| Next Command | △ | ○ | ◎ |
| Agent Mode | × | △ | ◎ |
| 実装工数 | 小 | 中 | 大 |
| セキュリティ | △ | ◎ | ◎ |

**推奨**: まず **Option B** で基本機能を実装し、需要に応じて **Option C** への移行を検討。

## 参考資料

- [ttyd - GitHub](https://github.com/tsl0922/ttyd)
- [Bun.spawn Terminal API](https://bun.com/docs/runtime/child-process)
- [Bun v1.3.5 Blog](https://bun.com/blog/bun-v1.3.5)
- [xterm.js Serialize Addon](https://github.com/xtermjs/xterm.js/tree/master/addons/addon-serialize)
- [bun-pty](https://github.com/sursaone/bun-pty)
- [ttyd WebSocket Protocol](https://moebuta.org/posts/porting-ttyd-to-golang-part-ii/)
