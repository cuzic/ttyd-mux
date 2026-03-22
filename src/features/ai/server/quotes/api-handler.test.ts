import { describe, expect, test } from 'bun:test';
import { findRoute, ROUTE_TABLE } from './api-handler.js';

describe('Claude Quotes API routing', () => {
  describe('findRoute', () => {
    test('matches exact route: /claude-quotes/sessions', () => {
      const result = findRoute('/claude-quotes/sessions');
      expect(result).not.toBeNull();
      expect(result!.route.exact).toBe('/claude-quotes/sessions');
    });

    test('matches pattern route: /claude-quotes/turn/:uuid', () => {
      const result = findRoute('/claude-quotes/turn/abc-123-def');
      expect(result).not.toBeNull();
      expect(result!.match).toBeDefined();
      expect(result!.match![1]).toBe('abc-123-def');
    });

    test('matches pattern route with URL-encoded uuid', () => {
      const result = findRoute('/claude-quotes/turn/abc%2F123');
      expect(result).not.toBeNull();
      expect(result!.match![1]).toBe('abc%2F123');
    });

    test('matches prefix route: /claude-quotes/recent', () => {
      const result = findRoute('/claude-quotes/recent');
      expect(result).not.toBeNull();
      expect(result!.route.prefix).toBe('/claude-quotes/recent');
    });

    test('matches prefix route with query string path: /claude-quotes/recent?limit=10', () => {
      // Note: query string is not part of apiPath, this tests prefix matching
      const result = findRoute('/claude-quotes/recent');
      expect(result).not.toBeNull();
    });

    test('matches longer prefix before shorter: /claude-quotes/recent-markdown vs /claude-quotes/recent', () => {
      const result = findRoute('/claude-quotes/recent-markdown');
      expect(result).not.toBeNull();
      expect(result!.route.prefix).toBe('/claude-quotes/recent-markdown');
    });

    test('matches longer prefix: /claude-quotes/git-diff-file vs /claude-quotes/git-diff', () => {
      const result = findRoute('/claude-quotes/git-diff-file');
      expect(result).not.toBeNull();
      expect(result!.route.prefix).toBe('/claude-quotes/git-diff-file');
    });

    test('matches /claude-quotes/git-diff', () => {
      const result = findRoute('/claude-quotes/git-diff');
      expect(result).not.toBeNull();
      expect(result!.route.prefix).toBe('/claude-quotes/git-diff');
    });

    test('matches /claude-quotes/project-markdown', () => {
      const result = findRoute('/claude-quotes/project-markdown');
      expect(result).not.toBeNull();
      expect(result!.route.prefix).toBe('/claude-quotes/project-markdown');
    });

    test('matches /claude-quotes/plans', () => {
      const result = findRoute('/claude-quotes/plans');
      expect(result).not.toBeNull();
      expect(result!.route.prefix).toBe('/claude-quotes/plans');
    });

    test('matches /claude-quotes/file-content', () => {
      const result = findRoute('/claude-quotes/file-content');
      expect(result).not.toBeNull();
      expect(result!.route.prefix).toBe('/claude-quotes/file-content');
    });

    test('returns null for unknown route', () => {
      const result = findRoute('/claude-quotes/unknown');
      expect(result).toBeNull();
    });

    test('returns null for non-claude-quotes path', () => {
      const result = findRoute('/api/sessions');
      expect(result).toBeNull();
    });

    test('does not match /claude-quotes/turn without uuid', () => {
      const result = findRoute('/claude-quotes/turn/');
      expect(result).toBeNull();
    });

    test('does not match /claude-quotes/turn with extra path segments', () => {
      const result = findRoute('/claude-quotes/turn/uuid/extra');
      expect(result).toBeNull();
    });
  });

  describe('ROUTE_TABLE', () => {
    test('has expected number of routes', () => {
      expect(ROUTE_TABLE.length).toBe(9);
    });

    test('all routes have a handler', () => {
      for (const route of ROUTE_TABLE) {
        expect(typeof route.handler).toBe('function');
      }
    });

    test('each route has exactly one matcher type', () => {
      for (const route of ROUTE_TABLE) {
        const matcherCount = [route.exact, route.pattern, route.prefix].filter(Boolean).length;
        expect(matcherCount).toBe(1);
      }
    });
  });
});
