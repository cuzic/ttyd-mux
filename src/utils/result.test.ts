import { describe, expect, test } from 'bun:test';
import {
  type Result,
  all,
  andThen,
  err,
  expect as expectResult,
  fromPromise,
  fromThrowable,
  getWarnings,
  hasWarnings,
  isErr,
  isOk,
  map,
  mapErr,
  ok,
  okWithWarnings,
  unwrap,
  unwrapOr,
  unwrapOrElse
} from './result.js';

describe('Result type', () => {
  describe('ok and err', () => {
    test('ok creates Ok result', () => {
      const result = ok(42);
      expect(result.ok).toBe(true);
      expect(result.value).toBe(42);
    });

    test('err creates Err result', () => {
      const result = err('error');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('error');
    });
  });

  describe('isOk and isErr', () => {
    test('isOk returns true for Ok', () => {
      expect(isOk(ok(1))).toBe(true);
      expect(isOk(err('e'))).toBe(false);
    });

    test('isErr returns true for Err', () => {
      expect(isErr(err('e'))).toBe(true);
      expect(isErr(ok(1))).toBe(false);
    });

    test('type narrowing works', () => {
      const result: Result<number, string> = ok(42);
      if (isOk(result)) {
        // TypeScript knows result.value is number
        const value: number = result.value;
        expect(value).toBe(42);
      }
    });
  });

  describe('map', () => {
    test('transforms Ok value', () => {
      const result = map(ok(5), (x) => x * 2);
      expect(result).toEqual(ok(10));
    });

    test('passes through Err', () => {
      const result = map(err('e'), (x: number) => x * 2);
      expect(result).toEqual(err('e'));
    });
  });

  describe('mapErr', () => {
    test('transforms Err error', () => {
      const result = mapErr(err('e'), (e) => ({ code: e }));
      expect(result).toEqual(err({ code: 'e' }));
    });

    test('passes through Ok', () => {
      const result = mapErr(ok(5), (e: string) => ({ code: e }));
      expect(result).toEqual(ok(5));
    });
  });

  describe('andThen', () => {
    test('chains Ok results', () => {
      const result = andThen(ok(5), (x) => ok(x * 2));
      expect(result).toEqual(ok(10));
    });

    test('returns first Err', () => {
      const result = andThen(ok(5), () => err('fail'));
      expect(result).toEqual(err('fail'));
    });

    test('skips function on Err', () => {
      let called = false;
      const result = andThen(err('e') as Result<number, string>, () => {
        called = true;
        return ok(10);
      });
      expect(result).toEqual(err('e'));
      expect(called).toBe(false);
    });
  });

  describe('unwrap', () => {
    test('returns value for Ok', () => {
      expect(unwrap(ok(42))).toBe(42);
    });

    test('throws for Err', () => {
      expect(() => unwrap(err('error'))).toThrow('Unwrap called on Err: error');
    });
  });

  describe('expect', () => {
    test('returns value for Ok', () => {
      expect(expectResult(ok(42), 'should have value')).toBe(42);
    });

    test('throws with custom message for Err', () => {
      expect(() => expectResult(err('error'), 'custom message')).toThrow('custom message: error');
    });
  });

  describe('unwrapOr', () => {
    test('returns value for Ok', () => {
      expect(unwrapOr(ok(42), 0)).toBe(42);
    });

    test('returns default for Err', () => {
      expect(unwrapOr(err('e'), 0)).toBe(0);
    });
  });

  describe('unwrapOrElse', () => {
    test('returns value for Ok', () => {
      expect(unwrapOrElse(ok(42), () => 0)).toBe(42);
    });

    test('computes default from error for Err', () => {
      expect(unwrapOrElse(err('error'), (e) => e.length)).toBe(5);
    });
  });

  describe('fromThrowable', () => {
    test('wraps successful function', () => {
      const safeParse = fromThrowable(JSON.parse);
      const result = safeParse('{"a": 1}');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual({ a: 1 });
      }
    });

    test('wraps throwing function', () => {
      const safeParse = fromThrowable(JSON.parse);
      const result = safeParse('invalid');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBeInstanceOf(Error);
      }
    });
  });

  describe('fromPromise', () => {
    test('wraps resolved promise', async () => {
      const result = await fromPromise(Promise.resolve(42));
      expect(result).toEqual(ok(42));
    });

    test('wraps rejected promise', async () => {
      const result = await fromPromise(Promise.reject(new Error('fail')));
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toBe('fail');
      }
    });
  });

  describe('all', () => {
    test('combines Ok results', () => {
      const results = [ok(1), ok(2), ok(3)];
      expect(all(results)).toEqual(ok([1, 2, 3]));
    });

    test('returns first Err', () => {
      const results: Result<number, string>[] = [ok(1), err('fail'), ok(3)];
      expect(all(results)).toEqual(err('fail'));
    });

    test('handles empty array', () => {
      expect(all([])).toEqual(ok([]));
    });
  });

  describe('okWithWarnings', () => {
    test('creates success with no warnings', () => {
      const result = okWithWarnings({ reloaded: ['a'] });
      expect(result.ok).toBe(true);
      expect(result.value).toEqual({ reloaded: ['a'] });
      expect(result.warnings).toEqual([]);
    });

    test('creates success with warnings', () => {
      const result = okWithWarnings(
        { reloaded: ['a'] },
        [{ code: 'RESTART', message: 'needs restart' }]
      );
      expect(result.ok).toBe(true);
      expect(result.value).toEqual({ reloaded: ['a'] });
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]!.code).toBe('RESTART');
    });
  });

  describe('hasWarnings', () => {
    test('returns false for ok without warnings', () => {
      const result = okWithWarnings(42);
      expect(hasWarnings(result)).toBe(false);
    });

    test('returns true for ok with warnings', () => {
      const result = okWithWarnings(42, [{ code: 'W', message: 'warn' }]);
      expect(hasWarnings(result)).toBe(true);
    });

    test('returns false for err', () => {
      const result = err('error');
      expect(hasWarnings(result)).toBe(false);
    });
  });

  describe('getWarnings', () => {
    test('returns warnings from ok', () => {
      const result = okWithWarnings(42, [{ code: 'W', message: 'warn' }]);
      expect(getWarnings(result)).toEqual([{ code: 'W', message: 'warn' }]);
    });

    test('returns empty array from err', () => {
      const result = err('error');
      expect(getWarnings(result)).toEqual([]);
    });
  });
});
