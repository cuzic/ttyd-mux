# Warp ターミナル AI 機能調査

調査日: 2026-03-01

## 概要

Warp は AI ネイティブなターミナルアプリケーションで、2025年に「Agentic Development Environment」として大幅に進化した。本ドキュメントでは、ttyd-mux への AI 機能実装の参考として、Warp の主要な AI 機能を調査・整理する。

## 主要 AI 機能

### 1. AI コマンド提案 (AI Command Suggestions)

**トリガー**: コマンドラインで `#` を入力

**動作**:
- `#` に続けて自然言語で説明を入力
- 例: `# find all txt files modified today`
- Warp AI がリアルタイムでコマンドを提案
- 提案されたコマンドは編集・実行可能

**利点**:
- コマンド構文を暗記する必要がない
- Google/Stack Overflow を検索せずに済む
- 複雑なオプションも自然言語で指定可能

**実装のポイント**:
- 入力の先頭が `#` かどうかを検出
- LLM API にプロンプトを送信
- 提案コマンドをインラインで表示
- Tab/Enter で確定、編集も可能に

### 2. コマンド修正 (Command Corrections)

**トリガー**: コマンド実行がエラーになったとき

**修正対象**:
| カテゴリ | 例 |
|---------|-----|
| タイポ | `gti status` → `git status` |
| フラグ不足 | `git push` → `git push --set-upstream origin branch` |
| 権限不足 | `apt install` → `sudo apt install` |
| パス間違い | `cd /usr/loca` → `cd /usr/local` |

**ベース技術**: [thefuck](https://github.com/nvbn/thefuck) (オープンソース)

**対応コマンド** (21+):
- git, docker, npm, pip, python, cargo, conda
- brew, apt, pacman, dnf
- kubectl, terraform
- その他汎用的なコマンド名修正

**UI**:
- エラー後、入力欄の上に修正候補パネルが表示
- 右矢印キーまたはクリックで適用

### 3. エラー説明 (Error Explanation)

**トリガー**: エラー出力を右クリック → "Ask Warp AI"

**機能**:
- 難解なエラーメッセージを平易な言葉で説明
- 根本原因を特定
- 修正手順をステップバイステップで提示
- 必要なコマンドを提案

**対応するエラー例**:
- コンパイルエラー (自動で修正提案)
- 依存関係の問題 (バージョン競合など)
- 設定ミス (一般的な問題を検出)
- パーミッションエラー

**実装のポイント**:
- ターミナル出力をブロック単位で管理
- エラー検出 (exit code, stderr, 特定パターン)
- コンテキストメニューまたはボタンで AI 説明を呼び出し
- コマンドと出力を LLM に送信

### 4. Agent Mode (Full Terminal Control)

**トリガー**: `Cmd + I` (macOS) / `Ctrl + I` (Windows/Linux)

**機能**:
- 自然言語でマルチステップのワークフローを実行
- 例: 「このプロジェクトをセットアップして」「テストを実行してエラーを修正して」

**Full Terminal Use**:
- PTY に直接アタッチ
- インタラクティブツールと対話可能:
  - データベースシェル (psql, mysql)
  - エディタ (vim, nano)
  - REPL (python, node)
  - デバッガ (gdb, lldb)
  - システムモニタ (top, htop)
- ターミナルバッファを読み取り、状態を理解

**制御オプション**:
| 操作 | 説明 |
|------|------|
| Enter | コマンドを1回許可 |
| Cmd+Shift+I | 類似コマンドを自動承認 |
| Ctrl+C | 中断して別のリクエストを入力 |
| Cmd+I | 手動で制御を取り戻す (Takeover) |

**セキュリティ**:
- Agent Profiles でコマンド実行権限を制御
- Secret Redaction は Full Terminal Use 中も有効
- 読み取り/書き込み/実行の権限を個別に設定可能

### 5. Active AI (プロアクティブな支援)

**Next Command**:
- セッション履歴とコンテキストを分析
- 次に実行しそうなコマンドを予測・提案
- プレビュー表示 → Tab で確定

**Prompt Suggestions**:
- 現在の状態に基づいて AI 推奨を表示
- Agent Mode への切り替えを提案

### 6. ワークフロー保存 (Warp Drive)

**機能**:
- よく使うコマンド/ワークフローを保存
- AI が自動で以下を生成:
  - 名前
  - 説明
  - パラメータ化

**共有**:
- チーム内でワークフローを共有
- オンデマンドで実行

### 7. プライバシー・セキュリティ

**Secret Redaction**:
- 機密情報を AI に送信前に自動マスク
- 環境変数、API キー、パスワードなど

**Zero Data Retention**:
- OpenAI/Anthropic にデータを保存しない
- ターミナル入出力はモデル訓練に使用されない

**BYOK (Bring Your Own Key)**:
- 自分の API キーを使用可能
- OpenAI, Anthropic, Google に対応

## マルチモデル対応

Warp は複数の AI モデルをサポート:

| モデル | 用途 |
|--------|------|
| Claude 3.5 Sonnet | デフォルト、高品質な応答 |
| Claude 3.5 Haiku | 高速な応答 |
| GPT-4o | 代替モデル |
| Claude Code, Codex, Gemini CLI | Agent として統合 |

## ttyd-mux での実装優先度

### Phase 1: 基本機能 (実装推奨)

| 機能 | 難易度 | 価値 | 備考 |
|------|--------|------|------|
| `#` で自然言語→コマンド | 中 | 高 | 入力フック + LLM API |
| エラー説明 | 中 | 高 | 出力監視 + コンテキストメニュー |
| コマンド修正 (thefuck) | 低 | 中 | 既存 OSS を活用 |

### Phase 2: 高度な機能 (将来検討)

| 機能 | 難易度 | 価値 | 備考 |
|------|--------|------|------|
| Next Command 予測 | 高 | 中 | 履歴分析 + LLM |
| Agent Mode | 高 | 高 | PTY 制御 + マルチターン |
| ワークフロー保存 | 中 | 中 | スニペット機能の拡張 |

## 参考資料

- [Warp: All Features](https://www.warp.dev/all-features)
- [Warp AI: Natural Language Coding Agents](https://www.warp.dev/warp-ai)
- [Command Corrections | Warp Docs](https://docs.warp.dev/terminal/entry/command-corrections)
- [Full Terminal Use | Warp Docs](https://docs.warp.dev/agent-platform/capabilities/full-terminal-use)
- [Using Agents | Warp Docs](https://docs.warp.dev/agents/using-agents)
- [Warp: Agent Mode Blog](https://www.warp.dev/blog/agent-mode)
- [Warp 2025 in Review](https://www.warp.dev/blog/2025-in-review)
- [thefuck - GitHub](https://github.com/nvbn/thefuck)
