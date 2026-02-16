/**
 * Custom ESLint rules for AI development anti-pattern detection
 *
 * These rules are designed to catch common issues in AI-generated code
 * and enforce best practices for error handling, CLI tools, and security.
 *
 * Rules:
 * - no-silent-catch: Detect catch blocks without logging/rethrowing
 * - no-silent-fallback: Detect fallback returns without logging
 * - require-error-cause: Require error cause preservation in rethrowing
 * - no-process-exit-in-lib: Prevent process.exit() in library code
 * - require-command-description: Ensure Commander.js commands have descriptions
 * - no-hardcoded-credentials: Detect hardcoded secrets and API keys
 */

module.exports = {
  rules: {
    // Error handling rules
    'no-silent-catch': require('./no-silent-catch.cjs'),
    'no-silent-fallback': require('./no-silent-fallback.cjs'),
    'require-error-cause': require('./require-error-cause.cjs'),
    // CLI tool rules
    'no-process-exit-in-lib': require('./no-process-exit-in-lib.cjs'),
    'require-command-description': require('./require-command-description.cjs'),
    // Security rules
    'no-hardcoded-credentials': require('./no-hardcoded-credentials.cjs')
  }
};
