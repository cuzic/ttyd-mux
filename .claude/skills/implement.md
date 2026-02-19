# /implement - GitHub Issue の実装

GitHub Issue を読み込み、受入条件に基づいて機能を実装するスキル。

## Usage

```
/implement <issue-number>
/implement #3
/implement 3 --plan-only    # 計画のみ作成
/implement 3 --must-have    # Must Have のみ実装
```

## Workflow

### Step 1: Issue の取得と分析

```bash
gh issue view <number>
```

Issue から以下を抽出:
- **Summary**: 機能の概要
- **Motivation**: なぜこの機能が必要か
- **Acceptance Criteria**: 受入条件（チェックリスト）
- **Technical Notes**: 実装のヒント

### Step 2: 実装計画の作成

1. **影響範囲の特定**
   - 新規ファイル
   - 変更が必要な既存ファイル
   - 追加が必要な依存関係

2. **実装順序の決定**
   - 依存関係を考慮
   - 基盤となる機能を先に

3. **計画をユーザーに提示**
   ```
   ## 実装計画

   ### 新規ファイル
   - src/daemon/feature/index.ts
   - src/daemon/feature/index.test.ts

   ### 変更ファイル
   - src/daemon/router.ts
   - src/daemon/toolbar/index.ts

   ### 依存関係
   - xterm-addon-search

   この計画で進めてよろしいですか？
   ```

### Step 3: 実装

各受入条件に対して:

1. **テストを書く**（TDD アプローチ推奨）
2. **実装を書く**
3. **テストを実行して確認**
4. **リファクタリング**
5. **コミット**

### Step 4: 検証

1. **全テスト実行**
   ```bash
   bun test
   ```

2. **型チェック**
   ```bash
   bun run typecheck
   ```

3. **リントチェック**
   ```bash
   bun run check
   ```

4. **E2E テスト（該当する場合）**
   ```bash
   bun run test:e2e
   ```

### Step 5: 完了報告

1. **Issue にコメント**
   ```bash
   gh issue comment <number> --body "実装完了しました。

   ## 完了した受入条件
   - [x] 条件1
   - [x] 条件2

   ## テスト結果
   - Unit tests: 全て成功
   - Coverage: 85%

   ## 確認方法
   1. xxx
   2. yyy
   "
   ```

2. **Issue をクローズ（承認後）**
   ```bash
   gh issue close <number>
   ```

## Acceptance Criteria Mapping

受入条件のカテゴリ:

| カテゴリ | 対応 | 説明 |
|---------|------|------|
| Must Have | 必須実装 | これがないとリリースできない |
| Should Have | 推奨実装 | 優先度高いが必須ではない |
| Could Have | オプション | 時間があれば |
| Won't Have | 対象外 | 今回は実装しない |

## Commit Convention

```bash
# 機能追加
git commit -m "feat(scope): description"

# バグ修正
git commit -m "fix(scope): description"

# テスト追加
git commit -m "test(scope): description"

# リファクタリング
git commit -m "refactor(scope): description"
```

## Progress Tracking

実装中は進捗を報告:

```
## 進捗状況

### Must Have (3/5 完了)
- [x] 条件1 ✅
- [x] 条件2 ✅
- [x] 条件3 ✅
- [ ] 条件4 ← 作業中
- [ ] 条件5

### 次のステップ
条件4 の実装を進めます...
```

## Error Handling

実装中に問題が発生した場合:

1. **技術的な障害**
   - 代替案を提案
   - ユーザーに判断を仰ぐ

2. **要件の不明確さ**
   - Issue にコメントで質問
   - ユーザーに確認

3. **スコープクリープ**
   - 本来の受入条件に集中
   - 追加要件は別 Issue として提案

## Example

```
User: /implement 3

Claude: ## Issue #3: Search within scrollback buffer

Issue を取得しました。

### Summary
スクロールバック内のテキスト検索機能を追加

### Acceptance Criteria (Must Have)
1. [ ] Ctrl+Shift+F で検索バーが開く
2. [ ] テキストを入力すると scrollback 内を検索できる
...

### 実装計画

**新規ファイル:**
- src/daemon/toolbar/search.ts - 検索ロジック
- src/daemon/toolbar/search.test.ts - テスト

**変更ファイル:**
- src/daemon/toolbar/index.ts - 検索 UI の統合
- package.json - xterm-addon-search 追加

**依存関係:**
- xterm-addon-search

この計画で進めてよろしいですか？

User: はい

Claude: まず xterm-addon-search をインストールします...
[実装を進める]
```
