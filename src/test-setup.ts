/**
 * Test setup - sets environment variables before any modules are loaded
 * This file is imported first by test files to ensure proper test isolation
 */

import { existsSync, mkdirSync, rmSync } from 'node:fs';

// Use a shared test state directory for all tests
export const TEST_STATE_DIR = `/tmp/ttyd-mux-test-${process.pid}`;

// Store original value to restore later
export const originalStateDir = process.env['TTYD_MUX_STATE_DIR'];

// Set test state directory immediately when this module is loaded
process.env['TTYD_MUX_STATE_DIR'] = TEST_STATE_DIR;

/**
 * Reset test state directory - call in beforeEach
 */
export function resetTestState(): void {
  if (existsSync(TEST_STATE_DIR)) {
    rmSync(TEST_STATE_DIR, { recursive: true });
  }
  mkdirSync(TEST_STATE_DIR, { recursive: true });
}

/**
 * Cleanup test state directory - call in afterEach
 */
export function cleanupTestState(): void {
  if (existsSync(TEST_STATE_DIR)) {
    rmSync(TEST_STATE_DIR, { recursive: true });
  }
}

/**
 * Restore original environment - call in afterAll
 */
export function restoreEnv(): void {
  if (originalStateDir !== undefined) {
    process.env['TTYD_MUX_STATE_DIR'] = originalStateDir;
  } else {
    process.env['TTYD_MUX_STATE_DIR'] = undefined;
  }
}
