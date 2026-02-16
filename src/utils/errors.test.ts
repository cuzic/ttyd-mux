import { describe, expect, test } from 'bun:test';
import { AppError, formatCliError, getErrorMessage } from './errors.js';

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
