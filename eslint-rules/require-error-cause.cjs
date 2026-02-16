/**
 * ESLint Rule: require-error-cause
 *
 * Ensures that when rethrowing errors in catch blocks,
 * the original error is preserved as the cause.
 *
 * This helps maintain error chains and makes debugging easier,
 * especially important in AI/LLM pipelines where errors can
 * occur at multiple layers.
 *
 * BAD:
 *   catch (e) { throw new Error('API failed'); }
 *
 * GOOD:
 *   catch (e) { throw new Error('API failed', { cause: e }); }
 */

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require error cause when rethrowing errors',
      category: 'Best Practices',
      recommended: true
    },
    messages: {
      missingCause:
        'When rethrowing, preserve the original error as cause: new Error("message", { cause: originalError })'
    },
    schema: []
  },

  create(context) {
    // Track the catch parameter name in each catch scope
    const catchParamStack = [];

    return {
      CatchClause(node) {
        // Get the catch parameter name (e.g., 'e' in 'catch (e)')
        const param = node.param;
        if (param && param.type === 'Identifier') {
          catchParamStack.push(param.name);
        } else {
          catchParamStack.push(null);
        }
      },

      'CatchClause:exit'() {
        catchParamStack.pop();
      },

      'CatchClause ThrowStatement'(node) {
        // Only check if we're in a catch block with a named parameter
        const catchParam = catchParamStack[catchParamStack.length - 1];
        if (!catchParam) return;

        const argument = node.argument;

        // Check if throwing a new Error
        if (
          argument &&
          argument.type === 'NewExpression' &&
          argument.callee.type === 'Identifier' &&
          argument.callee.name === 'Error'
        ) {
          const args = argument.arguments;

          // Check if there's a second argument with { cause: ... }
          if (args.length < 2) {
            context.report({
              node,
              messageId: 'missingCause'
            });
            return;
          }

          const secondArg = args[1];
          if (secondArg.type !== 'ObjectExpression') {
            context.report({
              node,
              messageId: 'missingCause'
            });
            return;
          }

          // Check if the object has a 'cause' property
          const hasCause = secondArg.properties.some(
            (prop) =>
              prop.type === 'Property' &&
              prop.key.type === 'Identifier' &&
              prop.key.name === 'cause'
          );

          if (!hasCause) {
            context.report({
              node,
              messageId: 'missingCause'
            });
          }
        }
      }
    };
  }
};
