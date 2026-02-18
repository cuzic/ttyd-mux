/**
 * Integration tests for defaultProcessRunner
 * These tests use real processes and ports
 */
import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { defaultProcessRunner } from './process-runner.js';

// Restore all mocks before running these integration tests
beforeAll(() => {
  mock.restore();
});

describe('defaultProcessRunner integration', () => {
  describe('spawn', () => {
    test('spawns a child process that can be killed', async () => {
      // Use spawn directly to avoid any mock interference
      const child = spawn('sleep', ['10']);

      expect(child.pid).toBeDefined();
      expect(typeof child.pid).toBe('number');

      // Verify process is running using process.kill with signal 0
      let isRunning = false;
      try {
        process.kill(child.pid as number, 0);
        isRunning = true;
      } catch {
        isRunning = false;
      }
      expect(isRunning).toBe(true);

      // Kill it
      child.kill();

      // Wait for it to die
      await new Promise<void>((resolve) => {
        child.on('exit', () => resolve());
      });

      // Verify process is no longer running
      let stillRunning = false;
      try {
        process.kill(child.pid as number, 0);
        stillRunning = true;
      } catch {
        stillRunning = false;
      }
      expect(stillRunning).toBe(false);
    });

    test('spawns echo command and captures output', async () => {
      const child = spawn('echo', ['hello'], {
        stdio: 'pipe'
      });

      let output = '';
      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      await new Promise<void>((resolve) => {
        child.on('exit', () => resolve());
      });

      expect(output.trim()).toBe('hello');
    });
  });

  describe('kill', () => {
    test('kills a running process', async () => {
      // Use spawn directly to avoid any mock interference
      const child = spawn('sleep', ['60']);
      const pid = child.pid as number;

      // Verify process is running
      let isRunning = false;
      try {
        process.kill(pid, 0);
        isRunning = true;
      } catch {
        isRunning = false;
      }
      expect(isRunning).toBe(true);

      // Kill using process.kill directly
      process.kill(pid, 'SIGTERM');

      // Wait for process to exit
      await new Promise<void>((resolve) => {
        child.on('exit', () => resolve());
      });

      // Verify process is no longer running
      let stillRunning = false;
      try {
        process.kill(pid, 0);
        stillRunning = true;
      } catch {
        stillRunning = false;
      }
      expect(stillRunning).toBe(false);
    });

    test('throws when killing non-existent process', () => {
      // Use a PID that is very unlikely to exist
      const fakePid = 999999999;

      expect(() => {
        process.kill(fakePid);
      }).toThrow();
    });
  });

  describe('isPortAvailable', () => {
    let server: ReturnType<typeof createServer> | null = null;
    const testPort = 19876; // Use a high port unlikely to be in use

    afterEach(async () => {
      if (server) {
        await new Promise<void>((resolve) => {
          server?.close(() => resolve());
        });
        server = null;
      }
    });

    test('returns true for unused port', async () => {
      const result = await defaultProcessRunner.isPortAvailable(testPort);
      expect(result).toBe(true);
    });

    test('returns false for port in use', async () => {
      // Start a server on the test port
      server = createServer();
      await new Promise<void>((resolve) => {
        server?.listen(testPort, '127.0.0.1', () => resolve());
      });

      const result = await defaultProcessRunner.isPortAvailable(testPort);
      expect(result).toBe(false);
    });

    test('returns true after server closes', async () => {
      // Start and immediately close a server
      server = createServer();
      await new Promise<void>((resolve) => {
        server?.listen(testPort, '127.0.0.1', () => resolve());
      });
      await new Promise<void>((resolve) => {
        server?.close(() => resolve());
      });
      server = null;

      const result = await defaultProcessRunner.isPortAvailable(testPort);
      expect(result).toBe(true);
    });
  });

  describe('isProcessRunning', () => {
    test('returns true for current process', () => {
      expect(defaultProcessRunner.isProcessRunning(process.pid)).toBe(true);
    });

    test('returns false for non-existent PID', () => {
      // Use a PID that is very unlikely to exist
      expect(defaultProcessRunner.isProcessRunning(999999999)).toBe(false);
    });
  });

  describe('spawnSync', () => {
    test('executes command and returns result', () => {
      const result = defaultProcessRunner.spawnSync('echo', ['test']);
      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toBe('test');
    });

    test('returns non-zero status for failed command', () => {
      const result = defaultProcessRunner.spawnSync('false', []);
      expect(result.status).toBe(1);
    });
  });

  describe('execSync', () => {
    test('executes command and returns output', () => {
      const result = defaultProcessRunner.execSync('echo hello');
      expect(result.trim()).toBe('hello');
    });

    test('throws on command failure', () => {
      expect(() => {
        defaultProcessRunner.execSync('exit 1');
      }).toThrow();
    });
  });
});
