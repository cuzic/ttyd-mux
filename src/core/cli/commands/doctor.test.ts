import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { resetDaemonClientDeps, setDaemonClientDeps } from '@/core/client/daemon-client.js';
import { createInMemoryStateStore } from '@/core/config/state-store.js';
import { createMockSocketClient } from '@/utils/socket-client.js';
import {
  BunCheck,
  ConfigCheck,
  DaemonCheck,
  formatCheckResult,
  hasFailures,
  runChecks,
  TmuxCheck,
  type CheckResult,
  type DoctorCheck
} from '@/core/cli/services/doctor-service.js';
import { doctorCommand } from './doctor.js';

describe('doctor command', () => {
  let consoleLogSpy: ReturnType<typeof spyOn>;
  let logs: string[];

  beforeEach(() => {
    logs = [];
    consoleLogSpy = spyOn(console, 'log').mockImplementation((msg: string) => {
      logs.push(msg);
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    resetDaemonClientDeps();
  });

  test('outputs check results in text mode', async () => {
    const stateStore = createInMemoryStateStore();
    const socketClient = createMockSocketClient({ exists: () => false });
    setDaemonClientDeps({ stateStore, socketClient });

    await doctorCommand({});

    // Should output check results
    expect(logs.some((log) => log.includes('bun'))).toBe(true);
    expect(logs.some((log) => log.includes('All checks passed') || log.includes('✓'))).toBe(true);
  });

  test('outputs JSON in json mode', async () => {
    const stateStore = createInMemoryStateStore();
    const socketClient = createMockSocketClient({ exists: () => false });
    setDaemonClientDeps({ stateStore, socketClient });

    await doctorCommand({ json: true });

    expect(logs.length).toBe(1);
    const json = JSON.parse(logs[0]!);
    expect(json).toHaveProperty('passed');
    expect(json).toHaveProperty('checks');
    expect(Array.isArray(json.checks)).toBe(true);
  });

  test('json output includes check details', async () => {
    const stateStore = createInMemoryStateStore();
    const socketClient = createMockSocketClient({ exists: () => false });
    setDaemonClientDeps({ stateStore, socketClient });

    await doctorCommand({ json: true });

    const json = JSON.parse(logs[0]!);
    expect(json.checks.length).toBeGreaterThan(0);

    const bunCheck = json.checks.find((c: { name: string }) => c.name === 'bun');
    expect(bunCheck).toBeDefined();
    expect(bunCheck.ok).toBe(true);
    expect(bunCheck.message).toContain('Bun');
  });
});

describe('doctor checks', () => {
  test('BunCheck returns ok when bun is installed', () => {
    const check = new BunCheck();
    const result = check.run();

    expect(result.ok).toBe(true);
    expect(result.name).toBe('bun');
    expect(result.message).toMatch(/Bun \d+\.\d+/);
  });

  test('TmuxCheck returns result based on tmux availability', () => {
    const check = new TmuxCheck();
    const result = check.run();

    expect(result.name).toBe('tmux');
    // tmux may or may not be installed
    if (result.ok) {
      expect(result.message).toContain('tmux');
    } else {
      expect(result.hint).toContain('Install tmux');
    }
  });

  test('ConfigCheck returns ok with default config', () => {
    const check = new ConfigCheck();
    const result = check.run({});

    expect(result.name).toBe('config');
    expect(result.ok).toBe(true);
  });

  test('DaemonCheck returns ok regardless of daemon state', async () => {
    const stateStore = createInMemoryStateStore();
    const socketClient = createMockSocketClient({ exists: () => false });
    setDaemonClientDeps({ stateStore, socketClient });

    const check = new DaemonCheck();
    const result = await check.run();

    expect(result.name).toBe('daemon');
    expect(result.ok).toBe(true); // Daemon check is informational
    expect(result.message).toBe('daemon not running');
  });
});

describe('runChecks', () => {
  test('runs all provided checks', async () => {
    const mockCheck1: DoctorCheck = {
      name: 'test1',
      run: () => ({ name: 'test1', ok: true, message: 'ok' })
    };
    const mockCheck2: DoctorCheck = {
      name: 'test2',
      run: () => ({ name: 'test2', ok: false, message: 'fail', hint: 'fix it' })
    };

    const results = await runChecks([mockCheck1, mockCheck2], {});

    expect(results.length).toBe(2);
    expect(results[0]!.name).toBe('test1');
    expect(results[1]!.name).toBe('test2');
  });

  test('skips port check when config is invalid', async () => {
    const portCheck: DoctorCheck = {
      name: 'port',
      run: () => ({ name: 'port', ok: true, message: 'ok' })
    };

    const results = await runChecks([portCheck], { config: undefined });

    expect(results.length).toBe(0);
  });
});

describe('formatCheckResult', () => {
  test('formats successful check with green checkmark', () => {
    const result: CheckResult = { name: 'test', ok: true, message: 'passed' };
    const formatted = formatCheckResult(result);

    expect(formatted).toContain('✓');
    expect(formatted).toContain('test');
    expect(formatted).toContain('passed');
  });

  test('formats failed check with red X', () => {
    const result: CheckResult = { name: 'test', ok: false, message: 'failed' };
    const formatted = formatCheckResult(result);

    expect(formatted).toContain('✗');
    expect(formatted).toContain('test');
    expect(formatted).toContain('failed');
  });

  test('includes hint for failed checks', () => {
    const result: CheckResult = { name: 'test', ok: false, message: 'failed', hint: 'try this' };
    const formatted = formatCheckResult(result);

    expect(formatted).toContain('Hint: try this');
  });

  test('does not include hint for successful checks', () => {
    const result: CheckResult = { name: 'test', ok: true, message: 'ok', hint: 'not shown' };
    const formatted = formatCheckResult(result);

    expect(formatted).not.toContain('Hint:');
  });
});

describe('hasFailures', () => {
  test('returns false when all checks pass', () => {
    const results: CheckResult[] = [
      { name: 'test1', ok: true, message: 'ok' },
      { name: 'test2', ok: true, message: 'ok' }
    ];

    expect(hasFailures(results)).toBe(false);
  });

  test('returns true when a check fails', () => {
    const results: CheckResult[] = [
      { name: 'test1', ok: true, message: 'ok' },
      { name: 'test2', ok: false, message: 'fail' }
    ];

    expect(hasFailures(results)).toBe(true);
  });

  test('ignores daemon check failures', () => {
    const results: CheckResult[] = [
      { name: 'test1', ok: true, message: 'ok' },
      { name: 'daemon', ok: false, message: 'not running' }
    ];

    expect(hasFailures(results)).toBe(false);
  });
});
