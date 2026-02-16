# tmux-session-picker 仕様書

## 概要

tmux のセッション一覧を表示し、数字キーまたは矢印キーで直感的にセッションを選択・アタッチできるCLIツール。

## 機能要件

### 基本機能

1. **セッション一覧表示**
   - `tmux list-sessions` の結果をパースして表示
   - セッション名、ウィンドウ数、作成日時、アタッチ状態を表示
   - 現在アタッチ中のセッションをハイライト

2. **セッション選択**
   - 数字キー (0-9): 対応するセッションに即座にアタッチ
   - 矢印キー (↑/↓) または j/k: カーソル移動
   - Enter: 選択中のセッションにアタッチ
   - q / Ctrl+C: キャンセル・終了

3. **アタッチ実行**
   - 選択後、`tmux attach-session -t <session>` を実行
   - 既にtmux内の場合は `tmux switch-client -t <session>` を実行

### 追加機能

4. **セッション操作**
   - d: 選択中のセッションをデタッチ（他クライアントをデタッチ）
   - x: 選択中のセッションを削除（確認プロンプト付き）
   - n: 新規セッション作成

5. **表示オプション**
   - セッションがない場合は新規作成を提案
   - エラー時は適切なメッセージを表示

## 非機能要件

- **起動速度**: 100ms以内に一覧表示
- **依存関係**: 最小限に抑える
- **互換性**: Node.js 18+ 対応
- **tmux依存**: tmux 2.0+ 対応

## UI仕様

### 表示フォーマット

```
tmux sessions:

  [1] main          3 windows  (created: 12/21 10:30)
> [2] dev           2 windows  (created: 12/21 14:00) *attached*
  [3] project-x     1 window   (created: 12/20 09:15)

↑↓/jk: move  Enter: attach  d: detach  x: kill  n: new  q: quit
```

### カラースキーム

| 要素 | 色 |
|------|-----|
| 選択中 (>) | cyan / bold |
| アタッチ中 (*attached*) | green |
| セッション番号 [n] | yellow |
| セッション名 | white / bold |
| ウィンドウ数・日時 | dim / gray |
| ヘルプ行 | dim |

## 技術仕様

### 使用ライブラリ

```json
{
  "dependencies": {
    "ink": "^4.0.0",
    "ink-select-input": "^5.0.0",
    "react": "^18.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0"
  }
}
```

### 代替案: 軽量版

Ink (React) を使わない軽量版も検討:

```json
{
  "dependencies": {
    "ansi-escapes": "^6.0.0",
    "chalk": "^5.0.0",
    "keypress": "^0.2.1"
  }
}
```

### アーキテクチャ

```
src/
├── index.ts          # エントリポイント
├── tmux.ts           # tmuxコマンド実行・パース
├── ui.ts             # ターミナルUI (キー入力、描画)
├── types.ts          # 型定義
└── utils.ts          # ユーティリティ
```

### 型定義

```typescript
interface TmuxSession {
  name: string;
  windows: number;
  created: Date;
  attached: boolean;
  id: string;
}

interface AppState {
  sessions: TmuxSession[];
  selectedIndex: number;
  loading: boolean;
  error: string | null;
}
```

### tmuxコマンド

```bash
# セッション一覧取得
tmux list-sessions -F "#{session_name}|#{session_windows}|#{session_created}|#{session_attached}"

# アタッチ (tmux外から)
tmux attach-session -t <session_name>

# スイッチ (tmux内から)
tmux switch-client -t <session_name>

# tmux内かどうか判定
echo $TMUX  # 空でなければtmux内
```

## コマンドライン引数

```
Usage: mugi [options]

Options:
  -h, --help      ヘルプ表示
  -v, --version   バージョン表示
  -l, --list      一覧表示のみ（インタラクティブなし）
  -n, --new       新規セッション作成
  -t, --target    セッション名を直接指定してアタッチ
```

## エラーハンドリング

| 状況 | 対応 |
|------|------|
| tmux未インストール | エラーメッセージ + インストール案内 |
| セッションなし | 新規作成の提案 |
| 選択セッションが消えた | 一覧を再取得 |
| アタッチ失敗 | エラー詳細を表示 |

## 実装フェーズ

### Phase 1: MVP
- [ ] セッション一覧取得・パース
- [ ] 矢印キー/数字キーでの選択
- [ ] Enter でアタッチ

### Phase 2: 基本機能完成
- [ ] カラー表示
- [ ] tmux内/外の判定・適切なコマンド実行
- [ ] q / Ctrl+C での終了

### Phase 3: 拡張機能
- [ ] セッション削除 (x)
- [ ] 他クライアントデタッチ (d)
- [ ] 新規セッション作成 (n)
- [ ] コマンドライン引数対応

## 参考

- [Ink - React for CLI](https://github.com/vadimdemedes/ink)
- [tmux man page](https://man7.org/linux/man-pages/man1/tmux.1.html)
