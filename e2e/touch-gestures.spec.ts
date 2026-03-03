import { test, expect, type Page, devices } from '@playwright/test';
import { spawn, execSync, type ChildProcess } from 'node:child_process';
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'node:net';

// Use test-specific state directory
const TEST_STATE_DIR = '/tmp/ttyd-mux-e2e-touch-state';
const TEST_DIR = '/tmp/ttyd-mux-e2e-touch-test';
const BASE_PATH = '/ttyd-mux';

process.env['TTYD_MUX_STATE_DIR'] = TEST_STATE_DIR;

async function findAvailablePort(startPort = 18680): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(startPort, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : startPort;
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      findAvailablePort(startPort + 1).then(resolve).catch(reject);
    });
  });
}

function createNativeTerminalConfig(port: number, useTmux = false): string {
  const configPath = join(TEST_DIR, 'touch-test-config.yaml');
  const configContent = `
daemon_port: ${port}
base_path: ${BASE_PATH}
base_port: 18600
session_backend: native
tmux_mode: ${useTmux ? 'attach' : 'none'}
native_terminal:
  scrollback: 10000
  output_buffer_size: 1000
`;
  writeFileSync(configPath, configContent);
  return configPath;
}

// Helper to perform swipe gesture
async function performSwipe(
  page: Page,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  steps = 10
): Promise<void> {
  const deltaX = (endX - startX) / steps;
  const deltaY = (endY - startY) / steps;

  // Touch start
  await page.evaluate(({ x, y }) => {
    const touch = new Touch({
      identifier: 0,
      target: document.elementFromPoint(x, y) || document.body,
      clientX: x,
      clientY: y,
      screenX: x,
      screenY: y,
      pageX: x,
      pageY: y,
    });
    const touchEvent = new TouchEvent('touchstart', {
      bubbles: true,
      cancelable: true,
      touches: [touch],
      targetTouches: [touch],
      changedTouches: [touch],
    });
    (document.elementFromPoint(x, y) || document.body).dispatchEvent(touchEvent);
  }, { x: startX, y: startY });

  // Touch move
  for (let i = 1; i <= steps; i++) {
    const x = startX + deltaX * i;
    const y = startY + deltaY * i;
    await page.evaluate(({ x, y }) => {
      const touch = new Touch({
        identifier: 0,
        target: document.elementFromPoint(x, y) || document.body,
        clientX: x,
        clientY: y,
        screenX: x,
        screenY: y,
        pageX: x,
        pageY: y,
      });
      const touchEvent = new TouchEvent('touchmove', {
        bubbles: true,
        cancelable: true,
        touches: [touch],
        targetTouches: [touch],
        changedTouches: [touch],
      });
      (document.elementFromPoint(x, y) || document.body).dispatchEvent(touchEvent);
    }, { x, y });
    await page.waitForTimeout(16); // ~60fps
  }

  // Touch end
  await page.evaluate(({ x, y }) => {
    const touch = new Touch({
      identifier: 0,
      target: document.elementFromPoint(x, y) || document.body,
      clientX: x,
      clientY: y,
      screenX: x,
      screenY: y,
      pageX: x,
      pageY: y,
    });
    const touchEvent = new TouchEvent('touchend', {
      bubbles: true,
      cancelable: true,
      touches: [],
      targetTouches: [],
      changedTouches: [touch],
    });
    (document.elementFromPoint(x, y) || document.body).dispatchEvent(touchEvent);
  }, { x: endX, y: endY });
}

// Use mobile device emulation at top level
test.use({
  ...devices['iPhone 12'],
  hasTouch: true,
});

test.describe('Touch Gestures', () => {
  let daemonProcess: ChildProcess | null = null;
  let daemonPort: number;
  const sessionName = 'e2e-touch-test';

  test.beforeAll(async () => {
    if (existsSync(TEST_STATE_DIR)) {
      rmSync(TEST_STATE_DIR, { recursive: true });
    }
    mkdirSync(TEST_STATE_DIR, { recursive: true });

    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });

    daemonPort = await findAvailablePort();
    const configPath = createNativeTerminalConfig(daemonPort);

    daemonProcess = spawn('bun', ['run', 'src/index.ts', 'start', '-f', '-c', configPath], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Daemon failed to start')), 15000);
      daemonProcess!.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log('[daemon stdout]', output);
        if (output.includes('daemon started') || output.includes('Native terminal server started')) {
          clearTimeout(timeout);
          setTimeout(resolve, 1000);
        }
      });
      daemonProcess!.stderr?.on('data', (data) => {
        console.error('[daemon stderr]', data.toString());
      });
    });

    // Create session
    await fetch(`http://127.0.0.1:${daemonPort}${BASE_PATH}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: sessionName, dir: TEST_DIR }),
    });

    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  test.afterAll(async () => {
    await fetch(`http://127.0.0.1:${daemonPort}${BASE_PATH}/api/sessions/${sessionName}`, {
      method: 'DELETE',
    }).catch(() => {});

    if (daemonProcess) {
      daemonProcess.kill('SIGTERM');
      daemonProcess = null;
    }

    for (const dir of [TEST_DIR, TEST_STATE_DIR]) {
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true });
      }
    }
  });

  test('terminal loads on mobile device', async ({ page }) => {
    await page.goto(`http://127.0.0.1:${daemonPort}${BASE_PATH}/${sessionName}/`);
    await page.waitForSelector('#terminal .xterm', { timeout: 15000 });
    await expect(page.locator('#terminal .xterm')).toBeVisible();
  });

  test('touch events are detected', async ({ page }) => {
    await page.goto(`http://127.0.0.1:${daemonPort}${BASE_PATH}/${sessionName}/`);
    await page.waitForSelector('#terminal .xterm', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Set up touch event listener
    const touchDetected = await page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        let detected = false;
        const handler = () => {
          detected = true;
          document.removeEventListener('touchstart', handler);
        };
        document.addEventListener('touchstart', handler, { capture: true });

        // Dispatch a test touch event
        const touch = new Touch({
          identifier: 0,
          target: document.body,
          clientX: 200,
          clientY: 300,
          screenX: 200,
          screenY: 300,
          pageX: 200,
          pageY: 300,
        });
        const touchEvent = new TouchEvent('touchstart', {
          bubbles: true,
          cancelable: true,
          touches: [touch],
          targetTouches: [touch],
          changedTouches: [touch],
        });
        document.body.dispatchEvent(touchEvent);

        setTimeout(() => resolve(detected), 100);
      });
    });

    expect(touchDetected).toBe(true);
  });

  test('Alt button activates alt mode', async ({ page }) => {
    await page.goto(`http://127.0.0.1:${daemonPort}${BASE_PATH}/${sessionName}/`);
    await page.waitForSelector('#terminal .xterm', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Click Alt button
    const altBtn = page.locator('#tui-alt');
    await expect(altBtn).toBeVisible();
    await altBtn.click();

    // Verify Alt button is active
    await expect(altBtn).toHaveClass(/active/);
  });

  test('Alt+swipe triggers scroll', async ({ page }) => {
    await page.goto(`http://127.0.0.1:${daemonPort}${BASE_PATH}/${sessionName}/`);
    await page.waitForSelector('#terminal .xterm', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Generate some scrollback content
    await page.locator('#terminal .xterm-helper-textarea').focus();
    for (let i = 0; i < 50; i++) {
      await page.keyboard.type(`echo "line ${i}"`, { delay: 10 });
      await page.keyboard.press('Enter');
      await page.waitForTimeout(50);
    }
    await page.waitForTimeout(500);

    // Set up scroll tracking
    await page.evaluate(() => {
      (window as Window & { __scrollLinesCallCount?: number }).__scrollLinesCallCount = 0;
      const term = (window as Window & { term?: { scrollLines: (n: number) => void } }).term;
      if (term) {
        const original = term.scrollLines.bind(term);
        term.scrollLines = (n: number) => {
          (window as Window & { __scrollLinesCallCount?: number }).__scrollLinesCallCount =
            ((window as Window & { __scrollLinesCallCount?: number }).__scrollLinesCallCount || 0) + 1;
          console.log('[TEST] scrollLines called with', n);
          original(n);
        };
      }
    });

    // Click Alt button to activate
    const altBtn = page.locator('#tui-alt');
    await altBtn.click();
    await expect(altBtn).toHaveClass(/active/);

    // Get terminal position
    const terminalBounds = await page.locator('#terminal .xterm').boundingBox();
    expect(terminalBounds).not.toBeNull();

    if (terminalBounds) {
      const centerX = terminalBounds.x + terminalBounds.width / 2;
      // Avoid the toolbar at the bottom - use upper portion of terminal
      const startY = terminalBounds.y + terminalBounds.height * 0.4;  // 40% from top
      const endY = terminalBounds.y + terminalBounds.height * 0.15;   // 15% from top

      // Perform swipe up gesture
      await performSwipe(page, centerX, startY, centerX, endY, 20);
      await page.waitForTimeout(500);
    }

    // Check if scrollLines was called
    const scrollCallCount = await page.evaluate(() => {
      return (window as Window & { __scrollLinesCallCount?: number }).__scrollLinesCallCount || 0;
    });

    console.log(`scrollLines was called ${scrollCallCount} times`);
    expect(scrollCallCount).toBeGreaterThan(0);
  });

  test('debug: check terminal and scrollLines availability', async ({ page }) => {
    await page.goto(`http://127.0.0.1:${daemonPort}${BASE_PATH}/${sessionName}/`);
    await page.waitForSelector('#terminal .xterm', { timeout: 15000 });
    await page.waitForTimeout(2000);

    const terminalInfo = await page.evaluate(() => {
      const term = (window as Window & { term?: { scrollLines?: (n: number) => void } }).term;
      return {
        hasTerm: !!term,
        hasScrollLines: typeof term?.scrollLines === 'function',
        termKeys: term ? Object.keys(term).slice(0, 20) : [],
      };
    });

    console.log('Terminal info:', JSON.stringify(terminalInfo, null, 2));

    expect(terminalInfo.hasTerm).toBe(true);
    expect(terminalInfo.hasScrollLines).toBe(true);
  });

  test('debug: check ModifierKeyState availability', async ({ page }) => {
    await page.goto(`http://127.0.0.1:${daemonPort}${BASE_PATH}/${sessionName}/`);
    await page.waitForSelector('#terminal .xterm', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Click Alt button
    const altBtn = page.locator('#tui-alt');
    await altBtn.click();
    await page.waitForTimeout(200);

    // Check if alt button has active class
    const hasActiveClass = await altBtn.evaluate(el => el.classList.contains('active'));
    console.log('Alt button has active class:', hasActiveClass);

    expect(hasActiveClass).toBe(true);
  });

  test('debug: console logs during Alt+swipe', async ({ page }) => {
    // Capture ALL console logs
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    await page.goto(`http://127.0.0.1:${daemonPort}${BASE_PATH}/${sessionName}/`);
    await page.waitForSelector('#terminal .xterm', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Add a debug hook to track touchstart events at document level
    await page.evaluate(() => {
      (window as Window & { __touchStartCount?: number }).__touchStartCount = 0;
      document.addEventListener('touchstart', () => {
        (window as Window & { __touchStartCount?: number }).__touchStartCount =
          ((window as Window & { __touchStartCount?: number }).__touchStartCount || 0) + 1;
        console.log('[DEBUG] document touchstart captured');
      }, { capture: true });
    });

    // Click Alt button
    const altBtn = page.locator('#tui-alt');
    await altBtn.click();
    await page.waitForTimeout(200);

    // Check alt is active
    const altActive = await altBtn.evaluate(el => el.classList.contains('active'));
    console.log('Alt button active:', altActive);

    // Get terminal position
    const terminalBounds = await page.locator('#terminal .xterm').boundingBox();
    console.log('Terminal bounds:', terminalBounds);

    if (terminalBounds) {
      const centerX = terminalBounds.x + terminalBounds.width / 2;
      // Avoid the toolbar at the bottom - use upper portion of terminal
      // The #tui toolbar is fixed at bottom and covers roughly the bottom 150-200px
      const startY = terminalBounds.y + terminalBounds.height * 0.4;  // 40% from top
      const endY = terminalBounds.y + terminalBounds.height * 0.15;   // 15% from top

      console.log(`Swipe from (${centerX}, ${startY}) to (${centerX}, ${endY})`);

      // Check what element is at the start position
      const elementAtStart = await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        if (!el) return null;
        return {
          tagName: el.tagName,
          id: el.id,
          className: el.className,
          closestTui: !!el.closest('#tui'),
          closestToggle: !!el.closest('#tui-toggle'),
          closestXterm: !!el.closest('.xterm'),
        };
      }, { x: centerX, y: startY });
      console.log('Element at swipe start position:', elementAtStart);

      // Perform swipe
      await performSwipe(page, centerX, startY, centerX, endY, 20);
      await page.waitForTimeout(500);
    }

    // Check how many touchstart events were captured
    const touchStartCount = await page.evaluate(() => {
      return (window as Window & { __touchStartCount?: number }).__touchStartCount || 0;
    });

    console.log('Touch start events captured at document:', touchStartCount);

    // Filter and display AltScroll logs
    const altScrollLogs = consoleLogs.filter(log => log.includes('AltScroll'));
    console.log('AltScroll logs:', altScrollLogs);

    const debugLogs = consoleLogs.filter(log =>
      log.includes('DEBUG') || log.includes('AltScroll') || log.includes('scroll') || log.includes('TerminalController')
    );
    console.log('All relevant logs:', debugLogs);

    // At least some touch events should be captured
    expect(touchStartCount).toBeGreaterThan(0);
  });
});

// Test with tmux mode
test.describe('Touch Gestures with tmux', () => {
  let daemonProcess: ChildProcess | null = null;
  let daemonPort: number;
  const sessionName = 'e2e-touch-tmux-test';
  const TMUX_TEST_STATE_DIR = '/tmp/ttyd-mux-e2e-touch-tmux-state';
  const TMUX_TEST_DIR = '/tmp/ttyd-mux-e2e-touch-tmux-test';

  test.beforeAll(async () => {
    // Clean up directories
    for (const dir of [TMUX_TEST_STATE_DIR, TMUX_TEST_DIR]) {
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true });
      }
      mkdirSync(dir, { recursive: true });
    }

    // Kill any existing tmux session with this name
    try {
      execSync(`tmux kill-session -t ${sessionName} 2>/dev/null || true`);
    } catch {
      // Ignore
    }

    // Create tmux session first
    execSync(`tmux new-session -d -s ${sessionName} -c ${TMUX_TEST_DIR}`);

    // Enable mouse mode in tmux
    execSync(`tmux set-option -t ${sessionName} -g mouse on`);

    daemonPort = await findAvailablePort(18780);

    // Create config with tmux mode
    const configPath = join(TMUX_TEST_DIR, 'touch-tmux-config.yaml');
    const configContent = `
daemon_port: ${daemonPort}
base_path: ${BASE_PATH}
base_port: 18700
session_backend: native
tmux_mode: attach
native_terminal:
  scrollback: 10000
  output_buffer_size: 1000
`;
    writeFileSync(configPath, configContent);

    process.env['TTYD_MUX_STATE_DIR'] = TMUX_TEST_STATE_DIR;

    daemonProcess = spawn('bun', ['run', 'src/index.ts', 'start', '-f', '-c', configPath], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
      env: { ...process.env, TTYD_MUX_STATE_DIR: TMUX_TEST_STATE_DIR },
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Daemon failed to start')), 15000);
      daemonProcess!.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log('[tmux-daemon stdout]', output);
        if (output.includes('daemon started') || output.includes('Native terminal server started')) {
          clearTimeout(timeout);
          setTimeout(resolve, 1000);
        }
      });
      daemonProcess!.stderr?.on('data', (data) => {
        console.error('[tmux-daemon stderr]', data.toString());
      });
    });

    // Create session (will attach to tmux)
    await fetch(`http://127.0.0.1:${daemonPort}${BASE_PATH}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: sessionName, dir: TMUX_TEST_DIR }),
    });

    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  test.afterAll(async () => {
    await fetch(`http://127.0.0.1:${daemonPort}${BASE_PATH}/api/sessions/${sessionName}`, {
      method: 'DELETE',
    }).catch(() => {});

    if (daemonProcess) {
      daemonProcess.kill('SIGTERM');
      daemonProcess = null;
    }

    // Kill tmux session
    try {
      execSync(`tmux kill-session -t ${sessionName} 2>/dev/null || true`);
    } catch {
      // Ignore
    }

    for (const dir of [TMUX_TEST_DIR, TMUX_TEST_STATE_DIR]) {
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true });
      }
    }
  });

  test('tmux session loads correctly', async ({ page }) => {
    await page.goto(`http://127.0.0.1:${daemonPort}${BASE_PATH}/${sessionName}/`);
    await page.waitForSelector('#terminal .xterm', { timeout: 15000 });
    await expect(page.locator('#terminal .xterm')).toBeVisible();
  });

  test('debug: check xterm.js buffer state with tmux', async ({ page }) => {
    await page.goto(`http://127.0.0.1:${daemonPort}${BASE_PATH}/${sessionName}/`);
    await page.waitForSelector('#terminal .xterm', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Generate content
    await page.locator('#terminal .xterm-helper-textarea').focus();
    for (let i = 0; i < 50; i++) {
      await page.keyboard.type(`echo "line ${i}"`, { delay: 5 });
      await page.keyboard.press('Enter');
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(500);

    // Check xterm.js buffer state
    const bufferInfo = await page.evaluate(() => {
      const term = (window as Window & { term?: {
        buffer?: {
          active?: {
            length?: number;
            baseY?: number;
            cursorY?: number;
            viewportY?: number;
          };
          normal?: {
            length?: number;
          };
        };
        rows?: number;
        cols?: number;
      } }).term;

      if (!term) return { error: 'term not found' };

      return {
        rows: term.rows,
        cols: term.cols,
        activeLength: term.buffer?.active?.length,
        normalLength: term.buffer?.normal?.length,
        baseY: term.buffer?.active?.baseY,
        cursorY: term.buffer?.active?.cursorY,
        viewportY: term.buffer?.active?.viewportY,
      };
    });

    console.log('xterm.js buffer info:', JSON.stringify(bufferInfo, null, 2));

    // With tmux, activeLength should be small (just screen rows)
    // Without tmux, activeLength would include scrollback
    expect(bufferInfo).toBeDefined();
  });

  test('debug: test sendWheel directly', async ({ page }) => {
    // Capture console logs
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    await page.goto(`http://127.0.0.1:${daemonPort}${BASE_PATH}/${sessionName}/`);
    await page.waitForSelector('#terminal .xterm', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Enable mouse mode in tmux
    await page.locator('#terminal .xterm-helper-textarea').focus();
    await page.keyboard.type('tmux set -g mouse on', { delay: 10 });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Generate scrollback content
    for (let i = 0; i < 50; i++) {
      await page.keyboard.type(`echo "tmux line ${i}"`, { delay: 5 });
      await page.keyboard.press('Enter');
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(500);

    // Capture middle lines before scroll (skip status bar at top)
    const linesBefore = await page.evaluate(() => {
      const term = (window as Window & { term?: { buffer?: { active?: { getLine?: (i: number) => { translateToString?: (trim: boolean) => string } } } } }).term;
      const lines: string[] = [];
      for (let i = 2; i < 8; i++) {  // Lines 2-7 (skip first 2 lines for status bar)
        const line = term?.buffer?.active?.getLine?.(i);
        lines.push(line?.translateToString?.(true) || '');
      }
      return lines.join('\n');
    });
    console.log('Lines before wheel (2-7):', linesBefore);

    // Try sending wheel events directly using sendWheel
    const wheelResult = await page.evaluate(() => {
      const client = (window as Window & { __TERMINAL_CLIENT__?: { sendInput: (data: string) => void } }).__TERMINAL_CLIENT__;
      if (!client) return { error: 'client not found' };

      // SGR extended mouse mode wheel up: ESC [ < 64 ; x ; y M
      // Try sending wheel up events
      const x = 10;
      const y = 10;
      const button = 64; // wheel up

      // Try both press only and press+release
      const pressSeq = `\x1b[<${button};${x};${y}M`;
      const releaseSeq = `\x1b[<${button};${x};${y}m`;

      console.log('[TEST] Sending wheel sequences:', JSON.stringify({ pressSeq, releaseSeq }));

      // Send multiple wheel events
      for (let i = 0; i < 5; i++) {
        client.sendInput(pressSeq);
        client.sendInput(releaseSeq);
      }

      return { sent: true, pressSeq, releaseSeq };
    });
    console.log('Wheel result:', JSON.stringify(wheelResult));
    await page.waitForTimeout(1000);

    // Capture middle lines after scroll
    const linesAfter = await page.evaluate(() => {
      const term = (window as Window & { term?: { buffer?: { active?: { getLine?: (i: number) => { translateToString?: (trim: boolean) => string } } } } }).term;
      const lines: string[] = [];
      for (let i = 2; i < 8; i++) {
        const line = term?.buffer?.active?.getLine?.(i);
        lines.push(line?.translateToString?.(true) || '');
      }
      return lines.join('\n');
    });
    console.log('Lines after wheel (2-7):', linesAfter);

    // Log client logs
    const clientLogs = consoleLogs.filter(l => l.includes('[TEST]') || l.includes('wheel') || l.includes('Wheel'));
    console.log('Wheel-related logs:', JSON.stringify(clientLogs, null, 2));

    // Check if content changed
    console.log('Content changed:', linesBefore !== linesAfter);
  });

  test('Alt+swipe scroll works with tmux', async ({ page }) => {
    // Capture console logs
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    await page.goto(`http://127.0.0.1:${daemonPort}${BASE_PATH}/${sessionName}/`);
    await page.waitForSelector('#terminal .xterm', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Enable mouse mode in tmux (required for wheel events)
    await page.locator('#terminal .xterm-helper-textarea').focus();
    await page.keyboard.type('tmux set -g mouse on', { delay: 10 });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Generate scrollback content in tmux
    for (let i = 0; i < 50; i++) {
      await page.keyboard.type(`echo "tmux line ${i}"`, { delay: 5 });
      await page.keyboard.press('Enter');
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(500);

    // Capture terminal content before scroll (lines 2-7, skip status bar)
    const contentBefore = await page.evaluate(() => {
      const term = (window as Window & { term?: { buffer?: { active?: { getLine?: (i: number) => { translateToString?: (trim: boolean) => string } } } } }).term;
      if (!term?.buffer?.active?.getLine) return '';
      const lines: string[] = [];
      for (let i = 2; i < 8; i++) {  // Skip first 2 lines (status bar)
        const line = term.buffer.active.getLine(i);
        if (line?.translateToString) {
          lines.push(line.translateToString(true));
        }
      }
      return lines.join('\n');
    });
    console.log('Terminal content before scroll (lines 2-7):', contentBefore);

    // First, test that simple input works by sending a test command
    await page.evaluate(() => {
      const client = (window as Window & { __TERMINAL_CLIENT__?: { sendInput: (data: string) => void } }).__TERMINAL_CLIENT__;
      if (client) {
        console.log('[TEST] Sending test echo command');
        client.sendInput('echo "SCROLL_TEST_MARKER"\n');
      }
    });
    await page.waitForTimeout(500);

    // Check if the marker appeared in terminal
    const hasMarker = await page.evaluate(() => {
      const term = (window as Window & { term?: { buffer?: { active?: { getLine?: (i: number) => { translateToString?: (trim: boolean) => string } } } } }).term;
      if (!term?.buffer?.active?.getLine) return false;
      for (let i = 0; i < 30; i++) {
        const line = term.buffer.active.getLine(i);
        if (line?.translateToString && line.translateToString(true).includes('SCROLL_TEST_MARKER')) {
          return true;
        }
      }
      return false;
    });
    console.log('Test marker found in terminal:', hasMarker);

    // Click Alt button to activate
    const altBtn = page.locator('#tui-alt');
    await altBtn.click();
    await expect(altBtn).toHaveClass(/active/);

    // Get terminal position
    const terminalBounds = await page.locator('#terminal .xterm').boundingBox();
    console.log('Terminal bounds:', terminalBounds);

    if (terminalBounds) {
      const centerX = terminalBounds.x + terminalBounds.width / 2;
      const startY = terminalBounds.y + terminalBounds.height * 0.4;
      const endY = terminalBounds.y + terminalBounds.height * 0.15;

      console.log(`Swipe from (${centerX}, ${startY}) to (${centerX}, ${endY})`);

      // Perform swipe up gesture (should scroll up to see older content)
      await performSwipe(page, centerX, startY, centerX, endY, 20);
      await page.waitForTimeout(1000);
    }

    // Capture terminal content after scroll (lines 2-7, skip status bar)
    const contentAfter = await page.evaluate(() => {
      const term = (window as Window & { term?: { buffer?: { active?: { getLine?: (i: number) => { translateToString?: (trim: boolean) => string } } } } }).term;
      if (!term?.buffer?.active?.getLine) return '';
      const lines: string[] = [];
      for (let i = 2; i < 8; i++) {  // Skip first 2 lines (status bar)
        const line = term.buffer.active.getLine(i);
        if (line?.translateToString) {
          lines.push(line.translateToString(true));
        }
      }
      return lines.join('\n');
    });
    console.log('Terminal content after scroll (lines 2-7):', contentAfter);

    // Log all scroll-related console messages
    const scrollLogs = consoleLogs.filter(log =>
      log.includes('scroll') || log.includes('Scroll') || log.includes('wheel') || log.includes('Wheel') ||
      log.includes('WebSocket') || log.includes('sendBytes') || log.includes('sendText')
    );
    console.log('Scroll-related logs:', scrollLogs);

    // Verify that content changed after scroll (tmux scrolled)
    console.log('Content changed:', contentBefore !== contentAfter);
    expect(contentBefore).not.toEqual(contentAfter);
  });
});
