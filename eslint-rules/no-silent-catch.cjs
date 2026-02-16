/**
 * ESLint Rule: no-silent-catch
 *
 * Detects catch blocks that silently swallow errors without:
 * - Logging the error (console.error, logger.error, etc.)
 * - Rethrowing the error
 * - Returning an error object
 *
 * This is a common anti-pattern in AI-generated code where errors
 * are caught but not properly handled, leading to silent failures.
 */

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow silent catch blocks (no log, no throw)',
      category: 'Best Practices',
      recommended: true
    },
    messages: {
      emptyCatch: 'Empty catch block silently swallows errors. Add error handling, logging, or rethrow.',
      silentCatch: 'Catch block neither logs nor rethrows error. This may cause silent failures.',
      silentFallback: 'Catch block returns fallback without logging error. Consider logging before fallback.'
    },
    schema: [
      {
        type: 'object',
        properties: {
          logFunctions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Function names that count as logging (e.g., "console.error", "logger.error")'
          },
          allowCommentedCatch: {
            type: 'boolean',
            description: 'Allow catch blocks with only comments (intentional silent catch)'
          },
          checkReturnFallback: {
            type: 'boolean',
            description: 'Also warn when returning fallback values without logging'
          }
        },
        additionalProperties: false
      }
    ]
  },

  create(context) {
    const options = context.options[0] || {};
    const logFunctions = new Set(
      options.logFunctions || [
        'console.error',
        'console.warn',
        'console.log',
        'logger.error',
        'logger.warn',
        'logger.info',
        'logError',
        'reportError',
        'captureException', // Sentry
        'captureError'
      ]
    );
    const allowCommentedCatch = options.allowCommentedCatch !== false;
    const checkReturnFallback = options.checkReturnFallback !== false;

    /**
     * Check if a node is a log function call
     */
    function isLogCall(node) {
      if (!node || node.type !== 'CallExpression') return false;

      const callee = node.callee;

      // Handle: console.error(...), logger.error(...)
      if (callee.type === 'MemberExpression') {
        const objectName = callee.object.name || callee.object.type;
        const propertyName = callee.property.name || callee.property.value;
        if (objectName && propertyName) {
          const fullName = `${objectName}.${propertyName}`;
          return logFunctions.has(fullName);
        }
      }

      // Handle: logError(...), reportError(...)
      if (callee.type === 'Identifier') {
        return logFunctions.has(callee.name);
      }

      return false;
    }

    /**
     * Check if a statement contains a log call (recursively)
     */
    function containsLogCall(node) {
      if (!node) return false;

      if (isLogCall(node)) return true;

      // Check nested structures
      switch (node.type) {
        case 'ExpressionStatement':
          return containsLogCall(node.expression);
        case 'IfStatement':
          return (
            containsLogCall(node.consequent) ||
            containsLogCall(node.alternate)
          );
        case 'BlockStatement':
          return node.body.some(containsLogCall);
        case 'CallExpression':
          return isLogCall(node) || node.arguments.some(containsLogCall);
        case 'AwaitExpression':
          return containsLogCall(node.argument);
        case 'ConditionalExpression':
          return (
            containsLogCall(node.consequent) ||
            containsLogCall(node.alternate)
          );
        default:
          return false;
      }
    }

    /**
     * Check if a statement is a throw statement
     */
    function containsThrow(node) {
      if (!node) return false;

      if (node.type === 'ThrowStatement') return true;

      switch (node.type) {
        case 'BlockStatement':
          return node.body.some(containsThrow);
        case 'IfStatement':
          return containsThrow(node.consequent) || containsThrow(node.alternate);
        default:
          return false;
      }
    }

    /**
     * Check if catch block has only comments (intentional silent catch)
     */
    function hasOnlyComments(catchClause) {
      const body = catchClause.body.body;
      if (body.length > 0) return false;

      // Check for comments in the catch block
      const sourceCode = context.sourceCode || context.getSourceCode();
      const comments = sourceCode.getCommentsInside(catchClause.body);
      return comments.length > 0;
    }

    /**
     * Check if catch block returns a fallback without logging
     */
    function returnsFallbackWithoutLogging(body) {
      let hasReturn = false;
      let hasLog = false;

      for (const stmt of body) {
        if (stmt.type === 'ReturnStatement') {
          hasReturn = true;
        }
        if (containsLogCall(stmt)) {
          hasLog = true;
        }
      }

      return hasReturn && !hasLog;
    }

    return {
      CatchClause(node) {
        const body = node.body.body;

        // Empty catch block
        if (body.length === 0) {
          // Allow if it has intentional comments
          if (allowCommentedCatch && hasOnlyComments(node)) {
            return;
          }
          context.report({
            node,
            messageId: 'emptyCatch'
          });
          return;
        }

        // Check for logging or throwing
        let hasThrow = false;
        let hasLog = false;

        for (const stmt of body) {
          if (containsThrow(stmt)) hasThrow = true;
          if (containsLogCall(stmt)) hasLog = true;
        }

        // Neither logs nor throws - silent fail
        if (!hasThrow && !hasLog) {
          // Check if it returns a fallback
          if (checkReturnFallback && returnsFallbackWithoutLogging(body)) {
            context.report({
              node,
              messageId: 'silentFallback'
            });
          } else {
            context.report({
              node,
              messageId: 'silentCatch'
            });
          }
        }
      }
    };
  }
};
