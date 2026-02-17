#!/usr/bin/env node
// scripts/complexity-report.mjs
// Biome の複雑度警告を解析してレポートを生成

import { execSync } from 'node:child_process';

const THRESHOLD = 15; // biome.json の maxAllowedComplexity と同じ

function runBiomeCheck() {
  try {
    // Biome check を実行（エラーでも出力を取得）
    const output = execSync('bunx biome check ./src --reporter=json 2>/dev/null', {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024
    });
    return JSON.parse(output);
  } catch (error) {
    // Biome がエラーを返しても stdout に JSON が出力される
    if (error.stdout) {
      try {
        return JSON.parse(error.stdout);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function extractComplexityIssues(diagnostics) {
  if (!diagnostics?.diagnostics) return [];

  return diagnostics.diagnostics
    .filter(d => d.category === 'lint/complexity/noExcessiveCognitiveComplexity')
    .map(d => {
      // description から複雑度を抽出
      const match = d.description?.match(/complexity of (\d+)/i);
      const complexity = match ? parseInt(match[1], 10) : 0;

      // ファイルパスと位置を抽出
      const file = d.location?.path?.file || 'unknown';
      const sourceCode = d.location?.sourceCode || '';

      // 行番号を計算（span の位置からソースコードを使って計算）
      const span = d.location?.span;
      let line = 0;
      if (span && sourceCode) {
        const beforeSpan = sourceCode.slice(0, span[0]);
        line = (beforeSpan.match(/\n/g) || []).length + 1;
      }

      // 関数名を抽出
      const funcMatch = sourceCode.slice(span?.[0] || 0, (span?.[0] || 0) + 100)
        .match(/(?:function|async\s+function|const|let|var|async)?\s*(\w+)\s*[(\[<:=]/);
      const funcName = funcMatch ? funcMatch[1] : 'anonymous';

      return {
        file: file.replace('./', ''),
        line,
        function: funcName,
        complexity,
        exceeds: complexity > THRESHOLD
      };
    })
    .sort((a, b) => b.complexity - a.complexity);
}

function printReport(issues) {
  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║                    COMPLEXITY REPORT                               ║');
  console.log('╠════════════════════════════════════════════════════════════════════╣');
  console.log(`║  Threshold: ${THRESHOLD}                                                       ║`);
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  if (issues.length === 0) {
    console.log('✅ No complexity issues found!\n');
    return;
  }

  // ヘッダー
  console.log('┌──────────────┬──────────────────────────────────────────┬──────┐');
  console.log('│  Complexity  │  File                                    │ Line │');
  console.log('├──────────────┼──────────────────────────────────────────┼──────┤');

  for (const issue of issues) {
    const complexityStr = String(issue.complexity).padStart(6);
    const status = issue.exceeds ? '⚠️ ' : '   ';
    const location = issue.file.replace('src/', '').slice(0, 38).padEnd(38);
    const line = String(issue.line).padStart(4);

    console.log(`│ ${status}${complexityStr}    │  ${location}│ ${line} │`);
  }

  console.log('└──────────────┴──────────────────────────────────────────┴──────┘');

  // サマリー
  const exceeding = issues.filter(i => i.exceeds).length;
  const total = issues.length;
  const maxComplexity = issues[0]?.complexity || 0;
  const avgComplexity = issues.length > 0
    ? (issues.reduce((sum, i) => sum + i.complexity, 0) / issues.length).toFixed(1)
    : 0;

  console.log('\n📊 Summary:');
  console.log(`   Total functions with high complexity: ${total}`);
  console.log(`   Exceeding threshold (>${THRESHOLD}): ${exceeding}`);
  console.log(`   Max complexity: ${maxComplexity}`);
  console.log(`   Avg complexity: ${avgComplexity}`);
  console.log('');

  if (exceeding > 0) {
    process.exit(1);
  }
}

// メイン
const result = runBiomeCheck();
if (!result) {
  console.error('Failed to run Biome check');
  process.exit(1);
}

const issues = extractComplexityIssues(result);
printReport(issues);
