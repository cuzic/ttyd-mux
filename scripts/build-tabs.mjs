/**
 * Build script for tabs client bundle
 *
 * Bundles src/daemon/tabs/client/index.ts into dist/tabs.js
 * using esbuild with IIFE format for browser execution.
 */

import * as esbuild from 'esbuild';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

const entryPoint = path.join(rootDir, 'src/daemon/tabs/client/index.ts');
const outFile = path.join(rootDir, 'dist/tabs.js');

// Ensure dist directory exists
const distDir = path.dirname(outFile);
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Check if entry point exists
if (!fs.existsSync(entryPoint)) {
  console.log('[build-tabs] Entry point not found, skipping build:', entryPoint);
  // Create empty placeholder for development
  fs.writeFileSync(outFile, '// Tabs bundle placeholder\nconsole.log("[Tabs] Bundle not built yet");');
  process.exit(0);
}

try {
  const result = await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    minify: true,
    format: 'iife',
    target: ['es2020'],
    outfile: outFile,
    sourcemap: false,
    // Don't include any Node.js built-ins
    platform: 'browser',
    // Log errors
    logLevel: 'info',
  });

  const stats = fs.statSync(outFile);
  console.log(`[build-tabs] Built ${outFile} (${(stats.size / 1024).toFixed(2)} KB)`);

  if (result.warnings.length > 0) {
    console.warn('[build-tabs] Warnings:', result.warnings);
  }
} catch (error) {
  console.error('[build-tabs] Build failed:', error);
  process.exit(1);
}
