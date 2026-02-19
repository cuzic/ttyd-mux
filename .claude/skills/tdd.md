# /tdd - Test-Driven Development Implementation

GitHub Issue の受入条件に基づいて、TDD（テスト駆動開発）で機能を実装するスキル。

## Usage

```
/tdd <issue-number>
/tdd #3
/tdd 3
```

## Workflow

このスキルは Research-Red-Green-Refactor-Review-ADR-Commit サイクルに従って実装を進める。

```
┌─────────────────────────────────────────────────────────────┐
│  Phase 1: Issue Analysis（課題分析）                        │
│  - Issue の取得と受入条件の抽出                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Phase 2: Research（予備調査）                  ← NEW       │
│  - Web 検索で技術調査                                       │
│  - 既存コードベースの調査                                   │
│  - ライブラリ・API の調査                                   │
│  - 実装アプローチの検討                                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Phase 3: Red（テストを書く）                               │
│  - 失敗するテストを書く                                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Phase 4: Green（テストを通す）                             │
│  - 最小限の実装                                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Phase 5: Refactor（リファクタリング）                      │
│  - コード品質改善                                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Phase 6: Self-Review（AIセルフレビュー）                   │
│  - コード品質チェック                                       │
│  - セキュリティチェック                                     │
│  - パフォーマンスチェック                                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Phase 7: ADR（設計決定の記録）                             │
│  - 重要な設計判断を文書化                                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Phase 8: Commit（コミット）                                │
│  - 変更をコミット                                           │
│  - 次の受入条件へ                                           │
└─────────────────────────────────────────────────────────────┘
```

### Phase 1: Issue Analysis（課題分析）

1. **GitHub Issue を取得**
   ```bash
   gh issue view <number>
   ```

2. **受入条件を抽出**
   - Must Have: 必須の受入条件
   - Should Have: 優先度の高い条件
   - Could Have: あると良い条件

3. **技術的な課題を特定**
   - 未知の技術・ライブラリ
   - 調査が必要な領域
   - 不明確な要件

### Phase 2: Research（予備調査）

実装前に必要な情報を収集する。

#### 2.1 Web 検索による技術調査

```markdown
## 調査項目

### 検索クエリ
1. "<技術名> <言語> example"
2. "<ライブラリ名> tutorial"
3. "<問題> best practices"
4. "<機能> implementation <フレームワーク>"
```

**検索例:**
```
- "xterm.js search addon typescript"
- "xterm-addon-search example"
- "terminal search functionality best practices"
- "PWA push notifications service worker"
```

#### 2.2 公式ドキュメントの確認

```markdown
## ドキュメント調査

### 確認すべきドキュメント
- [ ] ライブラリの公式ドキュメント
- [ ] API リファレンス
- [ ] Getting Started / Quick Start
- [ ] Examples / Samples
- [ ] GitHub README
- [ ] CHANGELOG（破壊的変更の確認）
```

**URL を取得して内容を確認:**
```
WebFetch: https://github.com/xtermjs/xterm.js/tree/master/addons/xterm-addon-search
WebFetch: https://www.npmjs.com/package/xterm-addon-search
```

#### 2.3 既存コードベースの調査

```markdown
## コードベース調査

### 類似実装の検索
- 同様のパターンが既にあるか
- 再利用できるコードがあるか
- 既存の設計パターンに従うべきか
```

**調査コマンド:**
```bash
# 類似機能の検索
grep -r "addEventListener" src/daemon/toolbar/
grep -r "xterm" src/

# ファイル構造の確認
ls -la src/daemon/toolbar/

# 既存の実装パターンを確認
cat src/daemon/toolbar/index.ts
```

#### 2.4 npm パッケージの調査

```markdown
## パッケージ調査

### 候補パッケージの評価
| パッケージ名 | 週間DL | 最終更新 | サイズ | 評価 |
|-------------|--------|---------|--------|------|
| package-a   | 100k   | 1週間前 | 50KB   | ⭐⭐⭐ |
| package-b   | 10k    | 1年前   | 200KB  | ⭐ |
```

**調査コマンド:**
```bash
# パッケージ情報の確認
npm info <package-name>

# 依存関係の確認
npm info <package-name> dependencies

# バンドルサイズの確認
# https://bundlephobia.com/package/<package-name>
```

#### 2.5 実装アプローチの検討

```markdown
## 実装アプローチ

### 選択肢
1. **アプローチ A**: [説明]
   - メリット: ...
   - デメリット: ...

2. **アプローチ B**: [説明]
   - メリット: ...
   - デメリット: ...

### 推奨
アプローチ A を採用。理由: ...
```

#### 2.6 調査結果のまとめ

```markdown
## 調査結果サマリー

### 使用する技術・ライブラリ
- xterm-addon-search v0.13.0
- 理由: 公式アドオン、活発にメンテナンス

### 実装方針
1. SearchAddon をインストール
2. toolbar/search.ts に検索ロジックを実装
3. 検索 UI を HTML に追加
4. キーボードショートカットを設定

### 参考資料
- [xterm-addon-search README](https://github.com/xtermjs/xterm.js/tree/master/addons/xterm-addon-search)
- [Example usage](https://xtermjs.org/docs/api/addons/search/)

### 懸念事項・リスク
- [ ] 大量のスクロールバックでのパフォーマンス
- [ ] モバイルでの検索 UI の使いやすさ

### 実装計画
この調査結果に基づいて実装を進めてよろしいですか？
```

### Phase 3: Red（テストを書く）

各受入条件に対して:

1. **テストファイルを作成/更新**
   ```typescript
   // src/feature/feature.test.ts
   import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

   describe('Feature Name', () => {
     describe('Acceptance Criteria 1', () => {
       it('should do something specific', () => {
         // Arrange
         // Act
         // Assert
         expect(result).toBe(expected);
       });
     });
   });
   ```

2. **テストが失敗することを確認**
   ```bash
   bun test src/feature/feature.test.ts
   ```

3. **失敗理由を記録**
   - 期待: X
   - 実際: Y (または未実装エラー)

### Phase 4: Green（テストを通す）

1. **最小限の実装を書く**
   - テストを通すための最小限のコード
   - 過度な最適化や汎用化はしない
   - "Make it work" が目標

2. **テストが成功することを確認**
   ```bash
   bun test src/feature/feature.test.ts
   ```

3. **全テストが通ることを確認**
   ```bash
   bun test
   ```

### Phase 5: Refactor（リファクタリング）

1. **コード品質の改善**
   - 重複の除去
   - 命名の改善
   - 関数の分割

2. **テストが引き続き通ることを確認**
   ```bash
   bun test
   ```

3. **リントチェック**
   ```bash
   bun run check
   ```

4. **型チェック**
   ```bash
   bun run typecheck
   ```

### Phase 6: Self-Review（AI セルフレビュー）

実装完了後、以下の観点でセルフレビューを実施:

#### 6.1 コード品質チェック

```markdown
## コード品質レビュー

### 可読性
- [ ] 関数名・変数名は意図を明確に表現しているか
- [ ] 複雑なロジックにはコメントがあるか
- [ ] 1つの関数が1つの責務を持っているか

### 保守性
- [ ] マジックナンバーは定数化されているか
- [ ] 重複コードはないか
- [ ] 依存関係は適切か（疎結合）

### 一貫性
- [ ] 既存コードのスタイルに従っているか
- [ ] エラーハンドリングは統一されているか
- [ ] ログ出力のフォーマットは統一されているか
```

#### 6.2 セキュリティチェック

```markdown
## セキュリティレビュー

### 入力検証
- [ ] ユーザー入力はサニタイズされているか
- [ ] パス traversal の対策はあるか
- [ ] コマンドインジェクションの対策はあるか

### 認証・認可
- [ ] 認証が必要なエンドポイントは保護されているか
- [ ] 機密情報はログに出力されていないか

### 依存関係
- [ ] 新しい依存関係にセキュリティ上の問題はないか
```

#### 6.3 パフォーマンスチェック

```markdown
## パフォーマンスレビュー

### 効率性
- [ ] 不要なループや再計算はないか
- [ ] 大きなデータ構造のコピーを避けているか
- [ ] 非同期処理は適切に使用されているか

### リソース管理
- [ ] メモリリークの可能性はないか
- [ ] ファイルハンドルやコネクションは適切にクローズされているか
```

#### 6.4 レビュー結果の報告

```markdown
## Self-Review 結果

### 問題なし ✅
- コード品質: 良好
- セキュリティ: 問題なし
- パフォーマンス: 適切

### 要改善 ⚠️
- [改善点があれば記載]

### 対応済み 🔧
- [改善した内容を記載]
```

### Phase 7: ADR（設計決定の記録）

重要な設計判断があった場合、ADR を作成:

#### 7.1 ADR が必要な場合

以下のいずれかに該当する場合:
- 新しいライブラリやフレームワークを導入した
- アーキテクチャに影響する設計判断をした
- 複数の選択肢から1つを選んだ
- 将来の開発者に伝えるべき背景がある
- 代替案を検討して却下した

#### 7.2 ADR テンプレート

```markdown
# ADR XXX: [タイトル]

## Status

Accepted

## Context

[なぜこの決定が必要だったか]

## Decision

[何を決定したか]

### 実装の詳細

[コード例や設定例]

### 代替案

[検討した代替案と却下理由]

## Consequences

### Positive
- [良い影響]

### Negative
- [悪い影響・トレードオフ]

## Notes

### 関連コミット
- `xxxxxxx feat: ...`

### 関連 Issue
- #XX
```

#### 7.3 ADR 番号の決定

```bash
# 既存 ADR の最大番号を確認
ls docs/adr/ | tail -1
# → 024-auto-reload-on-visibility.md

# 次の番号を使用
# → 025-xxx.md
```

#### 7.4 ADR が不要な場合

以下の場合は ADR をスキップ:
- 単純なバグ修正
- 既存パターンに従った実装
- 設計判断を伴わない変更
- リファクタリングのみ

```markdown
### ADR 判定

この変更は既存パターンに従った実装のため、ADR は不要です。
```

### Phase 8: Commit（コミット）

1. **変更をコミット**
   ```bash
   git add <files>
   git commit -m "feat: implement <feature> - <acceptance criteria>"
   ```

2. **ADR がある場合は一緒にコミット**
   ```bash
   git add docs/adr/XXX-*.md
   git commit -m "docs(adr): add ADR XXX for <decision>"
   ```

3. **次の受入条件へ進む**
   - Phase 3 に戻る
   - すべての Must Have が完了するまで繰り返す

## Test Patterns

### Unit Test Template

```typescript
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { cleanupTestState, resetTestState } from '@/test-setup.js';

describe('ModuleName', () => {
  beforeEach(() => {
    resetTestState();
  });

  afterEach(() => {
    cleanupTestState();
  });

  describe('functionName', () => {
    it('should handle normal case', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = functionName(input);

      // Assert
      expect(result).toBe('expected');
    });

    it('should handle edge case', () => {
      // ...
    });

    it('should throw on invalid input', () => {
      expect(() => functionName(null)).toThrow('Invalid input');
    });
  });
});
```

### Integration Test Template

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';

describe('Feature Integration', () => {
  let server: Server;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await server.close();
  });

  it('should work end-to-end', async () => {
    const response = await fetch(`http://localhost:${server.port}/api/endpoint`);
    expect(response.status).toBe(200);
  });
});
```

### Mock Pattern

```typescript
import { mock } from 'bun:test';

// Mock a module
mock.module('@/utils/logger.js', () => ({
  logger: {
    info: mock(),
    error: mock(),
    warn: mock(),
  },
}));

// Mock a function
const mockFn = mock((x: number) => x * 2);
expect(mockFn).toHaveBeenCalledWith(5);
expect(mockFn).toHaveBeenCalledTimes(1);
```

## Progress Tracking

実装の進捗は Issue のチェックリストで管理:

```markdown
## Acceptance Criteria

### Must Have
- [x] 完了した条件
- [ ] 未完了の条件 ← 現在作業中
- [ ] 未着手の条件

### Should Have
- [ ] 優先度の高い条件
```

各条件が完了したら:
```bash
# Issue のチェックボックスを更新するコメントを追加
gh issue comment <number> --body "✅ Completed: <acceptance criteria description>"
```

## Rules

1. **調査ファースト**: 実装前に必要な情報を収集する
2. **テストファースト**: 実装コードより先にテストを書く
3. **小さなステップ**: 一度に1つの受入条件だけ実装
4. **セルフレビュー必須**: 実装後は必ずセルフレビューを実施
5. **ADR 検討**: 設計判断があれば ADR を作成
6. **頻繁なコミット**: 各受入条件の完了ごとにコミット
7. **リグレッション防止**: 新しいテストを追加する前に既存テストが通ることを確認
8. **カバレッジ維持**: テストカバレッジを下げない

## Example Session

```
User: /tdd 3

Claude: ## Issue #3: Search within scrollback buffer

### Phase 1: Issue Analysis

**Must Have:**
1. [ ] Ctrl+Shift+F で検索バーが開く
2. [ ] テキストを入力すると scrollback 内を検索できる
3. [ ] マッチした箇所がハイライト表示される
...

### Phase 2: Research（予備調査）

#### Web 検索
「xterm.js search addon」で検索...

#### 公式ドキュメント確認
- xterm-addon-search: https://github.com/xtermjs/xterm.js/tree/master/addons/xterm-addon-search

#### 調査結果
- xterm.js 公式の search addon が利用可能
- `SearchAddon.findNext()` / `SearchAddon.findPrevious()` で検索
- ハイライトは addon が自動で処理

#### 実装計画
1. `bun add xterm-addon-search` でインストール
2. `src/daemon/toolbar/search.ts` を作成
3. 検索 UI を toolbar に追加
4. Ctrl+Shift+F のショートカット実装

この計画で進めてよろしいですか？

User: はい

Claude: ### Phase 3: Red - テストを書く

最初の受入条件「Ctrl+Shift+F で検索バーが開く」のテストを書きます。

[テストコードを作成]

テストを実行して失敗を確認します...

```
✗ should open search bar on Ctrl+Shift+F
  Expected: search bar to be visible
  Received: undefined
```

### Phase 4: Green - 実装

[最小限の実装コードを作成]

テストを実行...

```
✓ should open search bar on Ctrl+Shift+F
```

### Phase 5: Refactor

[必要に応じてリファクタリング]

### Phase 6: Self-Review

## Self-Review 結果

### コード品質 ✅
- 関数名は意図を明確に表現している
- 単一責務の原則に従っている
- 既存コードのスタイルに準拠

### セキュリティ ✅
- ユーザー入力（検索クエリ）は直接 DOM 操作に使用されていない
- 外部ライブラリ xterm-addon-search は信頼できるソース

### パフォーマンス ✅
- 検索は xterm.js の最適化された実装を使用
- 不要な再レンダリングを避けている

### Phase 7: ADR

この変更は新しいライブラリ（xterm-addon-search）を導入するため、
ADR を作成します。

[ADR 025 を作成]

### Phase 8: コミット

```bash
git commit -m "feat(search): add Ctrl+Shift+F shortcut to open search bar"
git commit -m "docs(adr): add ADR 025 for scrollback search implementation"
```

次の受入条件に進みます...
```

## Files Modified

このスキルは以下のファイルを作成/更新する可能性がある:

- `src/**/*.ts` - 実装コード
- `src/**/*.test.ts` - テストコード
- `docs/adr/*.md` - ADR ドキュメント
- `package.json` - 依存関係（必要な場合）
