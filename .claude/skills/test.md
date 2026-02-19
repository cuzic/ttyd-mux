# /test - テスト実行とカバレッジ確認

テストの実行、カバレッジ確認、失敗テストの分析を行うスキル。

## Usage

```
/test              # 全テスト実行
/test <path>       # 特定のパスのテスト実行
/test --coverage   # カバレッジ付きで実行
/test --watch      # ウォッチモードで実行
/test --failed     # 失敗テストのみ再実行
```

## Commands

### 全テスト実行

```bash
bun test
```

### 特定ファイル/ディレクトリのテスト

```bash
bun test src/daemon/
bun test src/daemon/toolbar/
bun test src/daemon/toolbar/index.test.ts
```

### カバレッジ付き実行

```bash
bun run test:coverage
```

### ウォッチモード

```bash
bun test --watch
```

### E2E テスト

```bash
bun run test:e2e
```

## Test Analysis

テストが失敗した場合:

1. **エラーメッセージを確認**
   - 期待値と実際の値の差分
   - スタックトレース

2. **失敗の種類を特定**
   - アサーション失敗: ロジックの問題
   - タイムアウト: 非同期処理の問題
   - モジュールエラー: インポートの問題

3. **修正方針を提案**
   - テストの修正が必要か
   - 実装の修正が必要か

## Coverage Report

カバレッジレポートの見方:

```
File                    | % Stmts | % Branch | % Funcs | % Lines |
------------------------|---------|----------|---------|---------|
src/daemon/toolbar/     |   85.71 |    75.00 |   90.00 |   85.71 |
  index.ts              |   85.71 |    75.00 |   90.00 |   85.71 |
```

- **Stmts**: 文のカバレッジ
- **Branch**: 分岐のカバレッジ
- **Funcs**: 関数のカバレッジ
- **Lines**: 行のカバレッジ

目標: 80% 以上を維持

## Quick Fixes

### よくあるエラーと対処法

**モジュールが見つからない**
```
Cannot find module '@/config/types.js'
```
→ パスエイリアスの確認、`bun run build` の実行

**タイムアウト**
```
Timeout - Async callback was not invoked within 5000ms
```
→ `async/await` の確認、タイムアウト値の調整

**モックの問題**
```
mock.module is not a function
```
→ `bun:test` からの正しいインポート確認

## Output

テスト結果のサマリー:
- 成功/失敗テスト数
- 失敗テストの詳細
- カバレッジ（`--coverage` 時）
- 修正が必要な場合の提案
