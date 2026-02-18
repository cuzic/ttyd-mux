import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { type LogLevel, createLogger, getLogLevel, setLogLevel } from './logger.js';

describe('logger', () => {
  let originalLogLevel: LogLevel;
  let consoleLogMock: ReturnType<typeof mock>;
  let consoleWarnMock: ReturnType<typeof mock>;
  let consoleErrorMock: ReturnType<typeof mock>;

  beforeEach(() => {
    originalLogLevel = getLogLevel();
    // biome-ignore lint/suspicious/noEmptyBlockStatements: mock needs empty function
    consoleLogMock = mock(() => {});
    // biome-ignore lint/suspicious/noEmptyBlockStatements: mock needs empty function
    consoleWarnMock = mock(() => {});
    // biome-ignore lint/suspicious/noEmptyBlockStatements: mock needs empty function
    consoleErrorMock = mock(() => {});
    console.log = consoleLogMock;
    console.warn = consoleWarnMock;
    console.error = consoleErrorMock;
  });

  afterEach(() => {
    setLogLevel(originalLogLevel);
  });

  describe('setLogLevel / getLogLevel', () => {
    test('sets and gets log level', () => {
      setLogLevel('debug');
      expect(getLogLevel()).toBe('debug');

      setLogLevel('error');
      expect(getLogLevel()).toBe('error');
    });
  });

  describe('createLogger', () => {
    test('creates logger with component name', () => {
      const log = createLogger('test-component');
      expect(log).toHaveProperty('debug');
      expect(log).toHaveProperty('info');
      expect(log).toHaveProperty('warn');
      expect(log).toHaveProperty('error');
    });
  });

  describe('log level filtering', () => {
    test('debug level logs all messages', () => {
      setLogLevel('debug');
      const log = createLogger('test');

      log.debug('debug message');
      log.info('info message');
      log.warn('warn message');
      log.error('error message');

      expect(consoleLogMock).toHaveBeenCalledTimes(2); // debug + info
      expect(consoleWarnMock).toHaveBeenCalledTimes(1);
      expect(consoleErrorMock).toHaveBeenCalledTimes(1);
    });

    test('info level skips debug messages', () => {
      setLogLevel('info');
      const log = createLogger('test');

      log.debug('debug message');
      log.info('info message');
      log.warn('warn message');
      log.error('error message');

      expect(consoleLogMock).toHaveBeenCalledTimes(1); // info only
      expect(consoleWarnMock).toHaveBeenCalledTimes(1);
      expect(consoleErrorMock).toHaveBeenCalledTimes(1);
    });

    test('warn level skips debug and info messages', () => {
      setLogLevel('warn');
      const log = createLogger('test');

      log.debug('debug message');
      log.info('info message');
      log.warn('warn message');
      log.error('error message');

      expect(consoleLogMock).toHaveBeenCalledTimes(0);
      expect(consoleWarnMock).toHaveBeenCalledTimes(1);
      expect(consoleErrorMock).toHaveBeenCalledTimes(1);
    });

    test('error level only logs errors', () => {
      setLogLevel('error');
      const log = createLogger('test');

      log.debug('debug message');
      log.info('info message');
      log.warn('warn message');
      log.error('error message');

      expect(consoleLogMock).toHaveBeenCalledTimes(0);
      expect(consoleWarnMock).toHaveBeenCalledTimes(0);
      expect(consoleErrorMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('message formatting', () => {
    test('includes timestamp, level, and component', () => {
      setLogLevel('info');
      const log = createLogger('my-component');

      log.info('test message');

      expect(consoleLogMock).toHaveBeenCalledTimes(1);
      const call = consoleLogMock.mock.calls[0];
      const message = call[0] as string;

      // Check format: [timestamp] LEVEL [component] message
      expect(message).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(message).toContain('INFO');
      expect(message).toContain('[my-component]');
      expect(message).toContain('test message');
    });

    test('passes additional arguments', () => {
      setLogLevel('info');
      const log = createLogger('test');

      log.info('message with data', { key: 'value' }, 123);

      expect(consoleLogMock).toHaveBeenCalledTimes(1);
      const call = consoleLogMock.mock.calls[0];
      expect(call[1]).toEqual({ key: 'value' });
      expect(call[2]).toBe(123);
    });
  });

  describe('level priority', () => {
    test('debug < info < warn < error', () => {
      const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];

      for (let i = 0; i < levels.length; i++) {
        setLogLevel(levels[i]);
        const log = createLogger('test');

        // Reset mocks
        consoleLogMock.mockClear();
        consoleWarnMock.mockClear();
        consoleErrorMock.mockClear();

        log.debug('d');
        log.info('i');
        log.warn('w');
        log.error('e');

        // Count total calls
        const debugCalls = levels[i] === 'debug' ? 1 : 0;
        const infoCalls = i <= 1 ? 1 : 0;
        const warnCalls = i <= 2 ? 1 : 0;
        const errorCalls = 1; // always logged

        expect(consoleLogMock).toHaveBeenCalledTimes(debugCalls + infoCalls);
        expect(consoleWarnMock).toHaveBeenCalledTimes(warnCalls);
        expect(consoleErrorMock).toHaveBeenCalledTimes(errorCalls);
      }
    });
  });
});
