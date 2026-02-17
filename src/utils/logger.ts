/**
 * Simple logger with timestamps and log levels
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

// Default log level (can be overridden by environment variable)
let currentLevel: LogLevel = (process.env['TTYD_MUX_LOG_LEVEL'] as LogLevel) || 'info';

function formatTimestamp(): string {
  return new Date().toISOString();
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentLevel];
}

function formatMessage(level: LogLevel, component: string, message: string): string {
  const timestamp = formatTimestamp();
  const levelUpper = level.toUpperCase().padEnd(5);
  return `[${timestamp}] ${levelUpper} [${component}] ${message}`;
}

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

export function createLogger(component: string) {
  return {
    debug(message: string, ...args: unknown[]): void {
      if (shouldLog('debug')) {
        // biome-ignore lint/suspicious/noConsole: Logger utility needs console
        console.log(formatMessage('debug', component, message), ...args);
      }
    },

    info(message: string, ...args: unknown[]): void {
      if (shouldLog('info')) {
        // biome-ignore lint/suspicious/noConsole: Logger utility needs console
        console.log(formatMessage('info', component, message), ...args);
      }
    },

    warn(message: string, ...args: unknown[]): void {
      if (shouldLog('warn')) {
        // biome-ignore lint/suspicious/noConsole: Logger utility needs console
        console.warn(formatMessage('warn', component, message), ...args);
      }
    },

    error(message: string, ...args: unknown[]): void {
      if (shouldLog('error')) {
        // biome-ignore lint/suspicious/noConsole: Logger utility needs console
        console.error(formatMessage('error', component, message), ...args);
      }
    }
  };
}

export type Logger = ReturnType<typeof createLogger>;
