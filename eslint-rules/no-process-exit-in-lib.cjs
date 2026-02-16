/**
 * ESLint Rule: no-process-exit-in-lib
 *
 * Prevents process.exit() calls in library/utility code.
 *
 * process.exit() should only be used in CLI entry points (src/index.ts, commands/).
 * Library code should throw errors or return Result types instead,
 * allowing the caller to handle the error appropriately.
 *
 * This is important for:
 * - Testability: process.exit() terminates tests
 * - Reusability: library code should be usable in different contexts
 * - Error handling: callers should decide how to handle errors
 */

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow process.exit() in library code',
      category: 'Best Practices',
      recommended: true
    },
    messages: {
      noProcessExit: 'Avoid process.exit() in library code. Throw an error or return a Result type instead.',
      noProcessExitSuggest: 'Consider throwing an Error instead: throw new Error("message")'
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowedPaths: {
            type: 'array',
            items: { type: 'string' },
            description: 'Glob patterns for files where process.exit() is allowed'
          }
        },
        additionalProperties: false
      }
    ]
  },

  create(context) {
    const options = context.options[0] || {};
    const allowedPaths = options.allowedPaths || [
      '**/index.ts',
      '**/index.js',
      '**/cli.ts',
      '**/cli.js',
      '**/commands/**',
      '**/bin/**'
    ];

    const filename = context.filename || context.getFilename();

    /**
     * Check if the current file matches any allowed path pattern
     */
    function isAllowedFile() {
      return allowedPaths.some(pattern => {
        // Simple glob matching (supports ** and *)
        const regex = new RegExp(
          '^' +
          pattern
            .replace(/\*\*/g, '<<<DOUBLESTAR>>>')
            .replace(/\*/g, '[^/]*')
            .replace(/<<<DOUBLESTAR>>>/g, '.*') +
          '$'
        );
        return regex.test(filename) || regex.test(filename.replace(/\\/g, '/'));
      });
    }

    // Skip check if file is in allowed list
    if (isAllowedFile()) {
      return {};
    }

    return {
      CallExpression(node) {
        // Check for process.exit()
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'process' &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'exit'
        ) {
          context.report({
            node,
            messageId: 'noProcessExit'
          });
        }
      }
    };
  }
};
