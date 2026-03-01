/**
 * Gitignore Pattern Matcher Tests
 */

import { describe, expect, test } from 'bun:test';
import { createMockFileSystem } from './deps.js';
import { GitignoreMatcher } from './gitignore.js';

describe('GitignoreMatcher', () => {
  describe('default ignored directories', () => {
    test('should always ignore node_modules', () => {
      const fs = createMockFileSystem({
        existsSync: () => false // No .gitignore
      });
      const matcher = new GitignoreMatcher('/project', fs);

      expect(matcher.isIgnored('node_modules')).toBe(true);
      expect(matcher.isIgnored('node_modules/package')).toBe(true);
      expect(matcher.isIgnored('src/node_modules')).toBe(true);
    });

    test('should always ignore .git', () => {
      const fs = createMockFileSystem({
        existsSync: () => false
      });
      const matcher = new GitignoreMatcher('/project', fs);

      expect(matcher.isIgnored('.git')).toBe(true);
      expect(matcher.isIgnored('.git/config')).toBe(true);
    });

    test('should always ignore .svn and .hg', () => {
      const fs = createMockFileSystem({
        existsSync: () => false
      });
      const matcher = new GitignoreMatcher('/project', fs);

      expect(matcher.isIgnored('.svn')).toBe(true);
      expect(matcher.isIgnored('.hg')).toBe(true);
    });

    test('should always ignore .DS_Store', () => {
      const fs = createMockFileSystem({
        existsSync: () => false
      });
      const matcher = new GitignoreMatcher('/project', fs);

      expect(matcher.isIgnored('.DS_Store')).toBe(true);
      expect(matcher.isIgnored('src/.DS_Store')).toBe(true);
    });
  });

  describe('.gitignore parsing', () => {
    test('should parse simple patterns', () => {
      const fs = createMockFileSystem({
        existsSync: () => true,
        readFileSync: () => '*.log\ndist/'
      });
      const matcher = new GitignoreMatcher('/project', fs);

      expect(matcher.isIgnored('error.log')).toBe(true);
      expect(matcher.isIgnored('src/debug.log')).toBe(true);
      expect(matcher.isIgnored('dist')).toBe(true);
      expect(matcher.isIgnored('dist/index.js')).toBe(true);
    });

    test('should skip comments and empty lines', () => {
      const fs = createMockFileSystem({
        existsSync: () => true,
        readFileSync: () => '# Comment\n\n*.log\n  # Another comment\n'
      });
      const matcher = new GitignoreMatcher('/project', fs);

      expect(matcher.isIgnored('error.log')).toBe(true);
      expect(matcher.isIgnored('# Comment')).toBe(false);
    });

    test('should handle globstar patterns', () => {
      const fs = createMockFileSystem({
        existsSync: () => true,
        readFileSync: () => '**/test/**/*.spec.js'
      });
      const matcher = new GitignoreMatcher('/project', fs);

      expect(matcher.isIgnored('test/foo.spec.js')).toBe(true);
      expect(matcher.isIgnored('src/test/bar/baz.spec.js')).toBe(true);
      expect(matcher.isIgnored('foo.spec.js')).toBe(false);
    });

    test('should handle negation patterns', () => {
      const fs = createMockFileSystem({
        existsSync: () => true,
        readFileSync: () => '*.log\n!important.log'
      });
      const matcher = new GitignoreMatcher('/project', fs);

      expect(matcher.isIgnored('error.log')).toBe(true);
      expect(matcher.isIgnored('important.log')).toBe(false);
    });

    test('should handle directory trailing slash', () => {
      const fs = createMockFileSystem({
        existsSync: () => true,
        readFileSync: () => 'build/'
      });
      const matcher = new GitignoreMatcher('/project', fs);

      expect(matcher.isIgnored('build')).toBe(true);
      expect(matcher.isIgnored('build/output.js')).toBe(true);
    });
  });

  describe('path normalization', () => {
    test('should normalize Windows-style paths', () => {
      const fs = createMockFileSystem({
        existsSync: () => true,
        readFileSync: () => 'dist/'
      });
      const matcher = new GitignoreMatcher('/project', fs);

      expect(matcher.isIgnored('dist\\index.js')).toBe(true);
    });
  });

  describe('error handling', () => {
    test('should handle read errors gracefully', () => {
      const fs = createMockFileSystem({
        existsSync: () => true,
        readFileSync: () => {
          throw new Error('Read error');
        }
      });
      const matcher = new GitignoreMatcher('/project', fs);

      // Should still work with default ignores
      expect(matcher.isIgnored('node_modules')).toBe(true);
      expect(matcher.isIgnored('src/index.js')).toBe(false);
    });
  });
});
