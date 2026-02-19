---
description: Claude Code のカスタムスキルを作成・改善する。新しいスキルを作りたい、既存スキルを改善したい、スキルの書き方を知りたいときに使用。
---

# /create-skill - スキル作成ガイド

Claude Code のカスタムスキルを作成するためのガイド。

## Usage

```
/create-skill <skill-name>        # 新規スキル作成
/create-skill improve <skill>     # 既存スキル改善
```

## スキルの構造

```
.claude/skills/
└── skill-name.md    # SKILL.md（必須）
```

複雑なスキルの場合:
```
.claude/skills/skill-name/
├── SKILL.md           # メイン（必須）
├── reference.md       # 参照資料（任意）
└── scripts/           # 実行スクリプト（任意）
```

## フロントマター

```yaml
---
description: [何をするか] + [いつ使うか]。三人称で記述。
---
```

### description のルール

- **必須**: 何をするか + いつ使うか
- **三人称**: "Processes..." ✓ / "I can help..." ✗
- **具体的に**: キーワードを含める
- **1024文字以内**

**良い例:**
```yaml
description: GitHub Issue を TDD で実装する。新機能の実装、テストが必要なバグ修正、品質重視の開発に使用。
```

**悪い例:**
```yaml
description: 開発を手伝います
```

## 本文の原則

### 1. 簡潔に

Claude は賢い。知っていることは省略。

```markdown
# 良い例（50トークン）
## PDF テキスト抽出
pdfplumber を使用:
\`\`\`python
import pdfplumber
with pdfplumber.open("file.pdf") as pdf:
    text = pdf.pages[0].extract_text()
\`\`\`

# 悪い例（150トークン）
PDF は Portable Document Format の略で...
まずライブラリをインストールして...
```

### 2. 適切な自由度

| 自由度 | 使い所 | 例 |
|--------|--------|-----|
| 高 | 複数アプローチ可 | コードレビュー手順 |
| 中 | パターンあり変動可 | テンプレート+カスタマイズ |
| 低 | 厳密な手順が必要 | DB マイグレーション |

### 3. Progressive Disclosure

- SKILL.md: 500行以内
- 詳細は別ファイルに分離
- 参照は1階層まで

```markdown
## 基本操作
[ここに簡潔な説明]

## 詳細
- **フォーム処理**: [FORMS.md](FORMS.md) 参照
- **API リファレンス**: [REFERENCE.md](REFERENCE.md) 参照
```

## ワークフローパターン

複雑なタスクはチェックリストで:

```markdown
## 実装ワークフロー

進捗チェックリスト:
- [ ] Step 1: 分析
- [ ] Step 2: 実装
- [ ] Step 3: 検証
- [ ] Step 4: 完了
```

## スキル作成手順

### Step 1: 目的を明確化

```markdown
## スキル設計

**名前**: [skill-name]
**目的**: [何を自動化/支援するか]
**トリガー**: [いつ使われるべきか]
```

### Step 2: フロントマター作成

```yaml
---
description: [目的] + [トリガー]。三人称。
---
```

### Step 3: 本文作成

1. 簡潔な概要
2. 使い方（Usage）
3. ワークフロー（必要なら）
4. 例（具体的に）

### Step 4: テスト

実際のタスクで使用し、改善点を特定。

## チェックリスト

作成したスキルを確認:

- [ ] description に「何を」+「いつ」が含まれている
- [ ] 三人称で記述されている
- [ ] 本文が500行以内
- [ ] 具体的な例がある
- [ ] 不要な説明を省いている

## 参考

- [Claude Code Skills Docs](https://code.claude.com/docs/en/skills)
- [Skill Best Practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
