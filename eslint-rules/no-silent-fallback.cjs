/**
 * ESLint Rule: no-silent-fallback
 *
 * Detects catch blocks that return fallback values without logging the error.
 * This is a common anti-pattern in AI-generated code where errors are silently
 * replaced with default values, making debugging extremely difficult.
 *
 * BAD:
 *   catch (e) { return null; }
 *   catch (e) { return defaultValue; }
 *   catch (e) { return fallbackFn(); }
 *
 * GOOD:
 *   catch (e) { console.error('Failed', e); return null; }
 *   catch (e) { logger.error(e); return defaultValue; }
 *   catch (e) { throw e; }
 *
 * Options:
 *   logFunctions: Array of function names considered as logging
 *   allowedFallbackPatterns: Regex patterns for allowed fallback function names
 *   requireErrorInLog: Require the caught error to be passed to log function
 */

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow returning fallback values in catch blocks without logging',
      category: 'Best Practices',
      recommended: true
    },
    messages: {
      silentFallback:
        'Catch block returns fallback without logging error. Add logging before returning fallback value.',
      silentFallbackCall:
        'Catch block calls fallback function "{{name}}" without logging error. Add logging before fallback.',
      errorNotLogged:
        'Caught error "{{param}}" is not passed to logging function. Include the error in your log call.'
    },
    schema: [
      {
        type: 'object',
        properties: {
          logFunctions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Function names that count as logging'
          },
          allowedFallbackPatterns: {
            type: 'array',
            items: { type: 'string' },
            description: 'Regex patterns for fallback functions that are allowed (e.g., "^log.*Fallback$")'
          },
          requireErrorInLog: {
            type: 'boolean',
            description: 'Require the caught error to be passed to the log function'
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
        'captureException',
        'captureError',
        'Sentry.captureException',
        'Sentry.captureError'
      ]
    );
    const allowedFallbackPatterns = (options.allowedFallbackPatterns || []).map(
      (p) => new RegExp(p)
    );
    const requireErrorInLog = options.requireErrorInLog || false;

    /**
     * Get the name of a callee (for logging)
     */
    function getCalleeName(callee) {
      if (callee.type === 'Identifier') {
        return callee.name;
      }
      if (callee.type === 'MemberExpression') {
        const objectName = callee.object.name || '';
        const propertyName = callee.property.name || callee.property.value || '';
        return `${objectName}.${propertyName}`;
      }
      return null;
    }

    /**
     * Check if a node is a log function call
     */
    function isLogCall(node) {
      if (!node || node.type !== 'CallExpression') return false;
      const name = getCalleeName(node.callee);
      return name && logFunctions.has(name);
    }

    /**
     * Check if an identifier refers to the catch parameter
     */
    function referencesError(node, errorParamName) {
      if (!node || !errorParamName) return false;

      switch (node.type) {
        case 'Identifier':
          return node.name === errorParamName;
        case 'CallExpression':
          return node.arguments.some((arg) => referencesError(arg, errorParamName));
        case 'MemberExpression':
          return referencesError(node.object, errorParamName);
        case 'ObjectExpression':
          return node.properties.some((prop) => {
            if (prop.type === 'Property') {
              return referencesError(prop.value, errorParamName);
            }
            if (prop.type === 'SpreadElement') {
              return referencesError(prop.argument, errorParamName);
            }
            return false;
          });
        case 'ArrayExpression':
          return node.elements.some((el) => el && referencesError(el, errorParamName));
        case 'TemplateLiteral':
          return node.expressions.some((expr) => referencesError(expr, errorParamName));
        case 'ConditionalExpression':
          return (
            referencesError(node.test, errorParamName) ||
            referencesError(node.consequent, errorParamName) ||
            referencesError(node.alternate, errorParamName)
          );
        default:
          return false;
      }
    }

    /**
     * Check if a log call includes the error parameter
     */
    function logIncludesError(node, errorParamName) {
      if (!isLogCall(node)) return false;
      return node.arguments.some((arg) => referencesError(arg, errorParamName));
    }

    /**
     * Find all log calls in a node tree
     */
    function findLogCalls(node, results = []) {
      if (!node) return results;

      if (isLogCall(node)) {
        results.push(node);
      }

      switch (node.type) {
        case 'ExpressionStatement':
          findLogCalls(node.expression, results);
          break;
        case 'BlockStatement':
          for (const stmt of node.body) {
            findLogCalls(stmt, results);
          }
          break;
        case 'IfStatement':
          findLogCalls(node.consequent, results);
          findLogCalls(node.alternate, results);
          break;
        case 'CallExpression':
          if (isLogCall(node)) {
            results.push(node);
          }
          break;
        case 'AwaitExpression':
          findLogCalls(node.argument, results);
          break;
      }

      return results;
    }

    /**
     * Check if a statement contains a throw
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
     * Find return statements in catch body
     */
    function findReturnStatements(body) {
      const returns = [];

      function visit(node) {
        if (!node) return;

        if (node.type === 'ReturnStatement') {
          returns.push(node);
          return;
        }

        switch (node.type) {
          case 'BlockStatement':
            for (const stmt of node.body) visit(stmt);
            break;
          case 'IfStatement':
            visit(node.consequent);
            visit(node.alternate);
            break;
          // Don't descend into nested functions
          case 'FunctionDeclaration':
          case 'FunctionExpression':
          case 'ArrowFunctionExpression':
            break;
        }
      }

      for (const stmt of body) {
        visit(stmt);
      }

      return returns;
    }

    /**
     * Check if a fallback function call is allowed
     */
    function isAllowedFallback(node) {
      if (!node || node.type !== 'CallExpression') return false;
      const name = getCalleeName(node.callee);
      if (!name) return false;
      return allowedFallbackPatterns.some((pattern) => pattern.test(name));
    }

    /**
     * Get the function name from a return argument
     */
    function getReturnFunctionName(returnArg) {
      if (!returnArg) return null;

      if (returnArg.type === 'CallExpression') {
        return getCalleeName(returnArg.callee);
      }
      if (returnArg.type === 'AwaitExpression' && returnArg.argument.type === 'CallExpression') {
        return getCalleeName(returnArg.argument.callee);
      }
      return null;
    }

    return {
      CatchClause(node) {
        const body = node.body.body;
        if (body.length === 0) return; // Handled by no-silent-catch

        // Get the catch parameter name
        const errorParamName =
          node.param && node.param.type === 'Identifier' ? node.param.name : null;

        // Skip if there's a throw statement
        if (body.some(containsThrow)) return;

        // Find all return statements
        const returnStatements = findReturnStatements(body);
        if (returnStatements.length === 0) return; // No returns, handled by no-silent-catch

        // Find all log calls
        const logCalls = findLogCalls(node.body);
        const hasLogging = logCalls.length > 0;

        // Check each return statement
        for (const returnStmt of returnStatements) {
          const returnArg = returnStmt.argument;

          // Skip if the return is an allowed fallback pattern
          if (returnArg && isAllowedFallback(returnArg)) {
            continue;
          }
          if (
            returnArg &&
            returnArg.type === 'AwaitExpression' &&
            isAllowedFallback(returnArg.argument)
          ) {
            continue;
          }

          // If no logging at all
          if (!hasLogging) {
            const funcName = getReturnFunctionName(returnArg);
            if (funcName) {
              context.report({
                node: returnStmt,
                messageId: 'silentFallbackCall',
                data: { name: funcName }
              });
            } else {
              context.report({
                node: returnStmt,
                messageId: 'silentFallback'
              });
            }
            continue;
          }

          // If logging exists but requireErrorInLog is enabled
          if (requireErrorInLog && errorParamName) {
            const errorIsLogged = logCalls.some((logCall) =>
              logIncludesError(logCall, errorParamName)
            );
            if (!errorIsLogged) {
              context.report({
                node: returnStmt,
                messageId: 'errorNotLogged',
                data: { param: errorParamName }
              });
            }
          }
        }
      }
    };
  }
};
