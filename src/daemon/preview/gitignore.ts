/**
 * Gitignore Pattern Matcher
 *
 * Simple .gitignore pattern matcher for filtering watched files.
 */

import type { FileSystemDeps } from './deps.js';

/** Parsed gitignore pattern */
interface GitignorePattern {
  pattern: RegExp;
  negated: boolean;
}

/**
 * Simple .gitignore pattern matcher
 *
 * Supports:
 * - Standard glob patterns (* and **)
 * - Directory patterns (ending with /)
 * - Negation patterns (starting with !)
 * - Comments (starting with #)
 * - Always ignores node_modules, .git, .svn
 */
export class GitignoreMatcher {
  private patterns: GitignorePattern[] = [];

  constructor(rootDir: string, fs: FileSystemDeps) {
    const gitignorePath = `${rootDir}/.gitignore`;
    if (fs.existsSync(gitignorePath)) {
      try {
        const content = fs.readFileSync(gitignorePath);
        this.parseGitignore(content);
      } catch {
        // Silently ignore read errors
      }
    }

    // Always ignore common directories
    this.addPattern('node_modules');
    this.addPattern('.git');
    this.addPattern('.svn');
    this.addPattern('.hg');
    this.addPattern('.DS_Store');
  }

  /**
   * Parse .gitignore content and extract patterns
   */
  private parseGitignore(content: string): void {
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      this.addPattern(trimmed);
    }
  }

  /**
   * Add a pattern to the matcher
   */
  private addPattern(pattern: string): void {
    const negated = pattern.startsWith('!');
    const cleanPattern = negated ? pattern.slice(1) : pattern;
    const regex = this.patternToRegex(cleanPattern);
    this.patterns.push({ pattern: regex, negated });
  }

  /**
   * Convert a glob pattern to a regular expression
   */
  private patternToRegex(pattern: string): RegExp {
    const isDirectoryPattern = pattern.endsWith('/');
    let cleanPattern = isDirectoryPattern ? pattern.slice(0, -1) : pattern;

    // Handle leading **/ (matches any path prefix including none)
    const hasLeadingGlobstar = cleanPattern.startsWith('**/');
    if (hasLeadingGlobstar) {
      cleanPattern = cleanPattern.slice(3);
    }

    // First, handle glob ? before escaping (to avoid conflict with regex ?)
    // Replace ? with a marker that won't conflict
    cleanPattern = cleanPattern.replace(/\?/g, '<<<QUESTION>>>');

    // Escape regex special characters except *
    const regex = cleanPattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      // Replace **/ with optional path prefix (must be done before single *)
      .replace(/\*\*\//g, '(.*/)?')
      // Replace remaining ** with any characters including /
      .replace(/\*\*/g, '.*')
      // Replace single * with any characters except /
      .replace(/\*/g, '[^/]*')
      // Restore ? markers as single character match
      .replace(/<<<QUESTION>>>/g, '.');

    // Build the prefix based on whether we had leading **/
    const prefix = hasLeadingGlobstar ? '(^|.*/)' : '(^|/)';

    // For directory patterns (ending with /):
    // - Also match anything inside the directory
    if (isDirectoryPattern) {
      // Match directory name and optionally anything inside
      return new RegExp(`${prefix}${regex}(/.*)?$`);
    }
    // Match pattern as a path segment or as the full path
    return new RegExp(`${prefix}${regex}(/|$)`);
  }

  /**
   * Check if a path should be ignored
   *
   * @param relativePath Path relative to the root directory
   * @returns true if the path should be ignored
   */
  isIgnored(relativePath: string): boolean {
    // Normalize path separators
    const normalizedPath = relativePath.replace(/\\/g, '/');

    let ignored = false;
    for (const { pattern, negated } of this.patterns) {
      if (pattern.test(normalizedPath)) {
        ignored = !negated;
      }
    }
    return ignored;
  }
}
