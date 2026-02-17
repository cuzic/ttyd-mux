import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import {
  AppError,
  formatCliError,
  getErrorMessage,
  handleCliError,
  withErrorHandling
} from './errors.js';

describe('getErrorMessage', () => {
  test('extracts message from Error instance', () => {
    const error = new Error('test error');
    expect(getErrorMessage(error)).toBe('test error');
  });

  test('returns string directly if error is a string', () => {
    expect(getErrorMessage('string error')).toBe('string error');
  });

  test('returns Unknown error for unknown types', () => {
    expect(getErrorMessage(null)).toBe('Unknown error');
    expect(getErrorMessage(undefined)).toBe('Unknown error');
    expect(getErrorMessage(123)).toBe('Unknown error');
    expect(getErrorMessage({})).toBe('Unknown error');
  });
});

describe('formatCliError', () => {
  test('formats error with prefix', () => {
    const error = new Error('test error');
    expect(formatCliError('Failed', error)).toBe('Failed: test error');
  });

  test('formats string error with prefix', () => {
    expect(formatCliError('Error', 'something went wrong')).toBe('Error: something went wrong');
  });
});

describe('AppError', () => {
  test('creates error with message', () => {
    const error = new AppError('test message');
    expect(error.message).toBe('test message');
    expect(error.name).toBe('AppError');
    expect(error.code).toBeUndefined();
  });

  test('creates error with code', () => {
    const error = new AppError('test message', 'ERR_CODE');
    expect(error.message).toBe('test message');
    expect(error.code).toBe('ERR_CODE');
  });

  test('creates error with cause', () => {
    const cause = new Error('original');
    const error = new AppError('wrapped', 'ERR_WRAP', cause);
    expect(error.message).toBe('wrapped');
    expect(error.cause).toBe(cause);
  });

  test('wrap creates AppError from unknown', () => {
    const original = new Error('original error');
    const wrapped = AppError.wrap(original, 'Wrapped error', 'WRAP_CODE');
    expect(wrapped).toBeInstanceOf(AppError);
    expect(wrapped.message).toBe('Wrapped error');
    expect(wrapped.code).toBe('WRAP_CODE');
    expect(wrapped.cause).toBe(original);
  });
});

describe('handleCliError', () => {
  let consoleErrorMock: ReturnType<typeof mock>;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    originalConsoleError = console.error;
    consoleErrorMock = mock(() => {});
    console.error = consoleErrorMock;
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  test('outputs formatted error to console.error', () => {
    const error = new Error('test error');
    handleCliError('Operation failed', error);

    expect(consoleErrorMock).toHaveBeenCalledTimes(1);
    expect(consoleErrorMock).toHaveBeenCalledWith('Operation failed: test error');
  });

  test('handles string errors', () => {
    handleCliError('Failed', 'string error');

    expect(consoleErrorMock).toHaveBeenCalledWith('Failed: string error');
  });
});

describe('withErrorHandling', () => {
  let consoleErrorMock: ReturnType<typeof mock>;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    originalConsoleError = console.error;
    consoleErrorMock = mock(() => {});
    console.error = consoleErrorMock;
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  test('returns result on success', async () => {
    const fn = async () => 'success';
    const result = await withErrorHandling(fn, 'Test');

    expect(result).toBe('success');
    expect(consoleErrorMock).not.toHaveBeenCalled();
  });

  test('returns null and logs error on failure', async () => {
    const fn = async () => {
      throw new Error('test error');
    };
    const result = await withErrorHandling(fn, 'Operation');

    expect(result).toBeNull();
    expect(consoleErrorMock).toHaveBeenCalledWith('Operation: test error');
  });
});
