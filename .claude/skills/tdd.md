# /tdd - Test-Driven Development Implementation

GitHub Issue の受入条件に基づいて、TDD（テスト駆動開発）で機能を実装するスキル。

## Usage

```
/tdd <issue-number>
/tdd #3
/tdd 3
```

## Workflow

このスキルは Red-Green-Refactor サイクルに従って実装を進める。

### Phase 1: Issue Analysis（課題分析）

1. **GitHub Issue を取得**
   ```bash
   gh issue view <number>
   ```

2. **受入条件を抽出**
   - Must Have: 必須の受入条件
   - Should Have: 優先度の高い条件
   - Could Have: あると良い条件

3. **実装計画を作成**
   - 受入条件をテストケースに分解
   - 依存関係を特定
   - ファイル構成を計画

4. **ユーザーに計画を確認**
   - 計画を提示して承認を得る
   - 疑問点があれば質問する

### Phase 2: Red（テストを書く）

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

### Phase 3: Green（テストを通す）

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

### Phase 4: Refactor（リファクタリング）

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

### Phase 5: Commit（コミット）

1. **変更をコミット**
   ```bash
   git add <files>
   git commit -m "feat: implement <feature> - <acceptance criteria>"
   ```

2. **次の受入条件へ進む**
   - Phase 2 に戻る
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

1. **テストファースト**: 実装コードより先にテストを書く
2. **小さなステップ**: 一度に1つの受入条件だけ実装
3. **頻繁なコミット**: 各受入条件の完了ごとにコミット
4. **リグレッション防止**: 新しいテストを追加する前に既存テストが通ることを確認
5. **カバレッジ維持**: テストカバレッジを下げない

## Example Session

```
User: /tdd 3

Claude: ## Issue #3: Search within scrollback buffer

### 受入条件の確認

**Must Have:**
1. [ ] Ctrl+Shift+F で検索バーが開く
2. [ ] テキストを入力すると scrollback 内を検索できる
3. [ ] マッチした箇所がハイライト表示される
...

### 実装計画

1. `xterm-addon-search` パッケージを追加
2. `src/daemon/toolbar/search.ts` を作成
3. 検索 UI コンポーネントを実装
4. キーボードショートカットを追加

この計画で進めてよろしいですか？

User: はい

Claude: ### Phase 2: Red - テストを書く

最初の受入条件「Ctrl+Shift+F で検索バーが開く」のテストを書きます。

[テストコードを作成]

テストを実行して失敗を確認します...

```
✗ should open search bar on Ctrl+Shift+F
  Expected: search bar to be visible
  Received: undefined
```

### Phase 3: Green - 実装

[最小限の実装コードを作成]

テストを実行...

```
✓ should open search bar on Ctrl+Shift+F
```

### Phase 4: Refactor

[必要に応じてリファクタリング]

### コミット

```bash
git commit -m "feat(search): add Ctrl+Shift+F shortcut to open search bar"
```

次の受入条件に進みます...
```

## Files Modified

このスキルは以下のファイルを作成/更新する可能性がある:

- `src/**/*.ts` - 実装コード
- `src/**/*.test.ts` - テストコード
- `package.json` - 依存関係（必要な場合）
