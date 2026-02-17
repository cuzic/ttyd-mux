// scripts/gen-version.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const outFile = new URL("../src/version.ts", import.meta.url);
mkdirSync(dirname(outFile.pathname), { recursive: true });

// Biome のフォーマット（single quote）に合わせる
const quote = (s) => `'${s}'`;

const content = `// This file is auto-generated. Do not edit manually.
export const NAME = ${quote(pkg.name)} as const;
export const VERSION = ${quote(pkg.version)} as const;
`;

writeFileSync(outFile, content, "utf8");
console.log(`generated: src/version.ts (${pkg.name}@${pkg.version})`);
