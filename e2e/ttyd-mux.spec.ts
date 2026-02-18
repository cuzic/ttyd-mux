import { test, expect, type Page } from '@playwright/test';
import { spawn, execSync, type ChildProcess } from 'node:child_process';
import { existsSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'node:net';

// Use test-specific state directory to avoid affecting production
const TEST_STATE_DIR = '/tmp/ttyd-mux-e2e-state';
const TEST_DIR = '/tmp/ttyd-mux-e2e-test';
const BASE_PATH = '/ttyd-mux';

// Set environment variable for test state directory
process.env['TTYD_MUX_STATE_DIR'] = TEST_STATE_DIR;

// Find an available port dynamically
async function findAvailablePort(startPort = 17680): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(startPort, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : startPort;
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      // Port in use, try next one
      findAvailablePort(startPort + 1).then(resolve).catch(reject);
    });
  });
}

// Create a temporary config file with the specified daemon port
function createTestConfig(daemonPort: number): string {
  const configPath = join(TEST_DIR, 'test-config.yaml');
  const configContent = `
daemon_port: ${daemonPort}
base_path: ${BASE_PATH}
base_port: 17600
`;
  writeFileSync(configPath, configContent);
  return configPath;
}

// Track processes and sessions for cleanup
const ttydProcesses: ChildProcess[] = [];
const tmuxSessions: Set<string> = new Set();

// Helper to start ttyd directly and wait for it
async function startTtyd(port: number, sessionName: string): Promise<ChildProcess> {
  const basePath = `${BASE_PATH}/${sessionName}`;

  const proc = spawn('ttyd', [
    '-p', String(port),
    '-b', basePath,
    '-W',  // Enable writable mode
    'tmux', 'new', '-A', '-s', sessionName,
  ], {
    cwd: TEST_DIR,
    detached: true,
    stdio: 'ignore',
  });

  proc.unref();
  ttydProcesses.push(proc);
  tmuxSessions.add(sessionName);

  // Wait for ttyd to start - use the correct base path
  await waitForTtyd(port, basePath, 10000);

  return proc;
}

// Helper to wait for ttyd to be available on its base path
async function waitForTtyd(port: number, basePath: string, timeout: number): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}${basePath}/`);
      if (response.ok || response.status === 200) {
        return;
      }
    } catch {
      // Port not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`ttyd on port ${port}${basePath} did not become available within ${timeout}ms`);
}

// Helper to wait for terminal to be ready
async function waitForTerminalReady(page: Page, timeout = 15000): Promise<void> {
  // Wait for xterm container and textarea to be present
  await page.waitForSelector('.xterm', { timeout });
  await page.waitForSelector('.xterm-helper-textarea', { timeout });
  // Give terminal time to fully initialize
  await page.waitForTimeout(1000);
}

// Helper to type in terminal
async function typeInTerminal(page: Page, text: string): Promise<void> {
  await page.locator('.xterm-helper-textarea').focus();
  await page.keyboard.type(text, { delay: 50 });
}

// Helper to press key in terminal
async function pressKey(page: Page, key: string): Promise<void> {
  await page.locator('.xterm-helper-textarea').focus();
  await page.keyboard.press(key);
}

// Helper to wait for file content to contain expected text
async function waitForFileContent(filePath: string, expected: string, timeout = 5000): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf-8');
      if (content.includes(expected)) {
        return true;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  return false;
}

// Helper to cleanup ttyd processes and tmux sessions
function cleanupTtydProcesses(): void {
  // Kill ttyd processes
  for (const proc of ttydProcesses) {
    try {
      if (proc.pid) {
        process.kill(proc.pid, 'SIGTERM');
      }
    } catch {
      // Ignore - process may have already exited
    }
  }
  ttydProcesses.length = 0;

  // Kill tmux sessions
  for (const session of tmuxSessions) {
    try {
      execSync(`tmux kill-session -t ${session} 2>/dev/null || true`, { stdio: 'ignore' });
    } catch {
      // Ignore
    }
  }
  tmuxSessions.clear();
}

// Port allocation for ttyd tests
let nextTtydPort = 17610;
async function allocateTtydPort(): Promise<number> {
  const port = await findAvailablePort(nextTtydPort);
  nextTtydPort = port + 1;
  return port;
}

test.describe('ttyd-mux E2E Tests', () => {
  test.beforeAll(async () => {
    // Clean up test state directory (not production!)
    if (existsSync(TEST_STATE_DIR)) {
      rmSync(TEST_STATE_DIR, { recursive: true });
    }
    mkdirSync(TEST_STATE_DIR, { recursive: true });

    // Create test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });

    // Kill any leftover test tmux sessions from previous runs (test-* pattern)
    try {
      execSync('tmux list-sessions -F "#{session_name}" 2>/dev/null | grep "^test-" | xargs -I {} tmux kill-session -t {} 2>/dev/null || true', { stdio: 'ignore' });
    } catch {
      // Ignore - no sessions or tmux not running
    }
  });

  test.afterAll(async () => {
    cleanupTtydProcesses();

    // Clean up test directories
    for (const dir of [TEST_DIR, TEST_STATE_DIR]) {
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true });
      }
    }
  });

  test.afterEach(async () => {
    // Clean up ttyd processes after each test
    cleanupTtydProcesses();
  });

  test('ttyd terminal loads and displays prompt', async ({ page }) => {
    const port = await allocateTtydPort();
    const sessionName = 'test-load';

    await startTtyd(port, sessionName);

    // Access ttyd directly
    await page.goto(`http://127.0.0.1:${port}${BASE_PATH}/${sessionName}/`);

    // Wait for terminal to load
    await waitForTerminalReady(page);

    // Verify terminal is visible
    await expect(page.locator('.xterm')).toBeVisible();
    await expect(page.locator('.xterm-helper-textarea')).toBeAttached();
  });

  test('can type in terminal and execute commands', async ({ page }) => {
    const port = await allocateTtydPort();
    const sessionName = 'test-echo';
    const outputFile = `${TEST_DIR}/echo-output.txt`;

    await startTtyd(port, sessionName);

    await page.goto(`http://127.0.0.1:${port}${BASE_PATH}/${sessionName}/`);
    await waitForTerminalReady(page);

    // Type echo command that writes to file
    await typeInTerminal(page, `echo "Hello E2E Test" > ${outputFile}`);
    await pressKey(page, 'Enter');

    // Wait for file to be created with expected content
    const hasContent = await waitForFileContent(outputFile, 'Hello E2E Test', 5000);
    expect(hasContent).toBe(true);
  });

  test('can create and list files via terminal', async ({ page }) => {
    const port = await allocateTtydPort();
    const sessionName = 'test-files';
    const testFileName = 'e2e-test-file.txt';
    const resultFile = `${TEST_DIR}/ls-result.txt`;

    await startTtyd(port, sessionName);

    await page.goto(`http://127.0.0.1:${port}${BASE_PATH}/${sessionName}/`);
    await waitForTerminalReady(page);

    // Create a file
    await typeInTerminal(page, `touch ${TEST_DIR}/${testFileName}`);
    await pressKey(page, 'Enter');
    await page.waitForTimeout(500);

    // List the file and save to result file
    await typeInTerminal(page, `ls ${TEST_DIR}/${testFileName} > ${resultFile}`);
    await pressKey(page, 'Enter');

    // Verify file listing was captured
    const hasResult = await waitForFileContent(resultFile, testFileName, 5000);
    expect(hasResult).toBe(true);
  });

  test('Ctrl+C interrupts running command', async ({ page }) => {
    const port = await allocateTtydPort();
    const sessionName = 'test-ctrlc';
    const markerFile = `${TEST_DIR}/interrupt-marker.txt`;

    await startTtyd(port, sessionName);

    await page.goto(`http://127.0.0.1:${port}${BASE_PATH}/${sessionName}/`);
    await waitForTerminalReady(page);

    // Start a long-running command
    await typeInTerminal(page, 'sleep 60');
    await pressKey(page, 'Enter');
    await page.waitForTimeout(500);

    // Send Ctrl+C
    await page.locator('.xterm-helper-textarea').focus();
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(500);

    // Verify we can type again (command was interrupted)
    await typeInTerminal(page, `echo "after interrupt" > ${markerFile}`);
    await pressKey(page, 'Enter');

    // Wait for marker file
    const hasMarker = await waitForFileContent(markerFile, 'after interrupt', 5000);
    expect(hasMarker).toBe(true);
  });

  test('tmux session persists across reconnections', async ({ page }) => {
    const port = await allocateTtydPort();
    const sessionName = 'test-persist';
    const varFile = `${TEST_DIR}/persist-var.txt`;
    const uniqueValue = `persist-${Date.now()}`;

    await startTtyd(port, sessionName);

    // First connection - set a variable and write to file
    await page.goto(`http://127.0.0.1:${port}${BASE_PATH}/${sessionName}/`);
    await waitForTerminalReady(page);

    await typeInTerminal(page, `export TEST_VAR="${uniqueValue}"`);
    await pressKey(page, 'Enter');
    await page.waitForTimeout(500);

    // Reload page (reconnect to same tmux session)
    await page.reload();
    await waitForTerminalReady(page);

    // Check variable still exists by writing it to file
    await typeInTerminal(page, `echo $TEST_VAR > ${varFile}`);
    await pressKey(page, 'Enter');

    // Verify the variable persisted
    const hasPersisted = await waitForFileContent(varFile, uniqueValue, 5000);
    expect(hasPersisted).toBe(true);
  });

  test('multiple terminals can run independently', async ({ page, context }) => {
    const port1 = await allocateTtydPort();
    const port2 = await allocateTtydPort();
    const session1 = 'test-multi-1';
    const session2 = 'test-multi-2';
    const file1 = `${TEST_DIR}/multi-1.txt`;
    const file2 = `${TEST_DIR}/multi-2.txt`;

    await startTtyd(port1, session1);
    await startTtyd(port2, session2);

    // Open first terminal
    await page.goto(`http://127.0.0.1:${port1}${BASE_PATH}/${session1}/`);
    await waitForTerminalReady(page);

    // Write unique value from first terminal
    await typeInTerminal(page, `echo "first" > ${file1}`);
    await pressKey(page, 'Enter');

    // Open second terminal in new tab
    const page2 = await context.newPage();
    await page2.goto(`http://127.0.0.1:${port2}${BASE_PATH}/${session2}/`);
    await waitForTerminalReady(page2);

    // Write unique value from second terminal
    await page2.locator('.xterm-helper-textarea').focus();
    await page2.keyboard.type(`echo "second" > ${file2}`, { delay: 50 });
    await page2.keyboard.press('Enter');

    // Verify both files have correct content
    const hasFirst = await waitForFileContent(file1, 'first', 5000);
    const hasSecond = await waitForFileContent(file2, 'second', 5000);

    expect(hasFirst).toBe(true);
    expect(hasSecond).toBe(true);

    await page2.close();
  });

  test('terminal handles special characters', async ({ page }) => {
    const port = await allocateTtydPort();
    const sessionName = 'test-special';
    const outputFile = `${TEST_DIR}/special-chars.txt`;

    await startTtyd(port, sessionName);

    await page.goto(`http://127.0.0.1:${port}${BASE_PATH}/${sessionName}/`);
    await waitForTerminalReady(page);

    // Test that terminal can handle and output special patterns
    await typeInTerminal(page, `echo "Special: test" > ${outputFile}`);
    await pressKey(page, 'Enter');

    const hasContent = await waitForFileContent(outputFile, 'Special:', 5000);
    expect(hasContent).toBe(true);
  });

  test('terminal supports arrow keys for history', async ({ page }) => {
    const port = await allocateTtydPort();
    const sessionName = 'test-history';
    const historyFile = `${TEST_DIR}/history-test.txt`;

    await startTtyd(port, sessionName);

    await page.goto(`http://127.0.0.1:${port}${BASE_PATH}/${sessionName}/`);
    await waitForTerminalReady(page);

    // Type and execute first command
    await typeInTerminal(page, `echo "first" > ${historyFile}`);
    await pressKey(page, 'Enter');
    await page.waitForTimeout(500);

    // Type second command
    await typeInTerminal(page, 'echo "second"');
    await pressKey(page, 'Enter');
    await page.waitForTimeout(500);

    // Press up arrow twice to get first command
    await pressKey(page, 'ArrowUp');
    await page.waitForTimeout(300);
    await pressKey(page, 'ArrowUp');
    await page.waitForTimeout(300);

    // Execute it (should overwrite file with "first")
    await pressKey(page, 'Enter');

    // Verify file still has "first" (command was recalled from history)
    await page.waitForTimeout(500);
    const hasFirst = await waitForFileContent(historyFile, 'first', 5000);
    expect(hasFirst).toBe(true);
  });
});

test.describe('ttyd-mux Daemon E2E', () => {
  let daemonProcess: ChildProcess | null = null;
  let daemonPort: number;

  test.beforeAll(async () => {
    // Clean up test state directory (not production!)
    if (existsSync(TEST_STATE_DIR)) {
      rmSync(TEST_STATE_DIR, { recursive: true });
    }
    mkdirSync(TEST_STATE_DIR, { recursive: true });

    // Ensure test directory exists
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }

    // Find an available port
    daemonPort = await findAvailablePort();
    const configPath = createTestConfig(daemonPort);

    // Start daemon in foreground with custom config
    daemonProcess = spawn('bun', ['run', 'src/index.ts', 'daemon', '-f', '-c', configPath], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
    });

    // Wait for daemon to start
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Daemon failed to start'));
      }, 10000);

      daemonProcess!.stdout?.on('data', (data) => {
        if (data.toString().includes('daemon started')) {
          clearTimeout(timeout);
          setTimeout(resolve, 500);
        }
      });

      daemonProcess!.stderr?.on('data', (data) => {
        console.error('[daemon]', data.toString());
      });
    });
  });

  test.afterAll(async () => {
    if (daemonProcess) {
      daemonProcess.kill('SIGTERM');
      daemonProcess = null;
    }

    cleanupTtydProcesses();
  });

  test('daemon portal page loads', async ({ page }) => {
    await page.goto(`http://127.0.0.1:${daemonPort}${BASE_PATH}/`);

    await expect(page.locator('h1')).toContainText('ttyd-mux');
  });

  test('daemon portal shows no sessions message when empty', async ({ page }) => {
    await page.goto(`http://127.0.0.1:${daemonPort}${BASE_PATH}/`);

    await expect(page.locator('text=No active sessions')).toBeVisible();
  });

  test('daemon API returns status', async ({ request }) => {
    const response = await request.get(`http://127.0.0.1:${daemonPort}${BASE_PATH}/api/status`);

    expect(response.ok()).toBeTruthy();

    const status = await response.json();
    expect(status).toHaveProperty('daemon');
    expect(status).toHaveProperty('sessions');
    expect(Array.isArray(status.sessions)).toBeTruthy();
  });

  test('daemon API returns sessions list', async ({ request }) => {
    const response = await request.get(`http://127.0.0.1:${daemonPort}${BASE_PATH}/api/sessions`);

    expect(response.ok()).toBeTruthy();

    const sessions = await response.json();
    expect(Array.isArray(sessions)).toBeTruthy();
  });
});
