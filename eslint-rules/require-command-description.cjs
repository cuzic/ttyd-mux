/**
 * ESLint Rule: require-command-description
 *
 * Ensures Commander.js commands have descriptions.
 *
 * This rule detects:
 * - .command() calls without .description()
 * - .option() calls without description parameter
 * - .argument() calls without description parameter
 *
 * Good documentation is essential for CLI tools, especially when
 * AI-generated code might skip descriptions for brevity.
 */

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require descriptions for Commander.js commands and options',
      category: 'Best Practices',
      recommended: true
    },
    messages: {
      missingCommandDescription: 'Command "{{name}}" is missing a description. Add .description() for better --help output.',
      missingOptionDescription: 'Option "{{name}}" is missing a description. Add description as second parameter.',
      missingArgumentDescription: 'Argument "{{name}}" is missing a description. Add description as second parameter.'
    },
    schema: [
      {
        type: 'object',
        properties: {
          checkOptions: {
            type: 'boolean',
            description: 'Check .option() calls for descriptions',
            default: true
          },
          checkArguments: {
            type: 'boolean',
            description: 'Check .argument() calls for descriptions',
            default: true
          }
        },
        additionalProperties: false
      }
    ]
  },

  create(context) {
    const options = context.options[0] || {};
    const checkOptions = options.checkOptions !== false;
    const checkArguments = options.checkArguments !== false;

    // Track commands to check for descriptions
    const commandCalls = new Map();

    /**
     * Get the string value from a node if possible
     */
    function getStringValue(node) {
      if (!node) return null;
      if (node.type === 'Literal' && typeof node.value === 'string') {
        return node.value;
      }
      if (node.type === 'TemplateLiteral' && node.quasis.length === 1) {
        return node.quasis[0].value.cooked;
      }
      return null;
    }

    /**
     * Check if a call chain includes .description()
     */
    function hasDescriptionInChain(node) {
      let current = node;

      // Walk up the chain to find .description()
      while (current.parent) {
        const parent = current.parent;

        // Check if parent is a member expression accessing our result
        if (
          parent.type === 'MemberExpression' &&
          parent.object === current &&
          parent.property.type === 'Identifier' &&
          parent.property.name === 'description'
        ) {
          return true;
        }

        // Check if parent is a call expression where we're the callee's object
        if (
          parent.type === 'CallExpression' &&
          parent.callee === current
        ) {
          current = parent;
          continue;
        }

        // Check if we're in a method chain
        if (
          parent.type === 'MemberExpression' &&
          parent.object === current
        ) {
          current = parent;
          continue;
        }

        break;
      }

      return false;
    }

    return {
      CallExpression(node) {
        // Check for method calls on objects
        if (node.callee.type !== 'MemberExpression') return;

        const methodName = node.callee.property.type === 'Identifier'
          ? node.callee.property.name
          : null;

        if (!methodName) return;

        // Check .command() calls
        if (methodName === 'command') {
          const commandName = getStringValue(node.arguments[0]) || '<command>';

          // Store this command call to check later
          commandCalls.set(node, { name: commandName, node });
        }

        // Check .option() calls
        if (checkOptions && methodName === 'option') {
          const optionName = getStringValue(node.arguments[0]) || '<option>';

          // .option() should have at least 2 arguments (flags, description)
          if (node.arguments.length < 2) {
            context.report({
              node,
              messageId: 'missingOptionDescription',
              data: { name: optionName }
            });
          } else {
            // Second argument should be a string description
            const descArg = node.arguments[1];
            if (descArg.type !== 'Literal' || typeof descArg.value !== 'string') {
              // It might be a default value object instead of description
              if (descArg.type === 'ObjectExpression' || descArg.type === 'Identifier') {
                context.report({
                  node,
                  messageId: 'missingOptionDescription',
                  data: { name: optionName }
                });
              }
            }
          }
        }

        // Check .argument() calls
        if (checkArguments && methodName === 'argument') {
          const argName = getStringValue(node.arguments[0]) || '<argument>';

          // .argument() should have at least 2 arguments (name, description)
          if (node.arguments.length < 2) {
            context.report({
              node,
              messageId: 'missingArgumentDescription',
              data: { name: argName }
            });
          } else {
            // Second argument should be a string description
            const descArg = node.arguments[1];
            if (descArg.type !== 'Literal' || typeof descArg.value !== 'string') {
              if (descArg.type === 'ObjectExpression' || descArg.type === 'Identifier') {
                context.report({
                  node,
                  messageId: 'missingArgumentDescription',
                  data: { name: argName }
                });
              }
            }
          }
        }
      },

      'Program:exit'() {
        // Check all command calls for descriptions
        for (const [callNode, info] of commandCalls) {
          if (!hasDescriptionInChain(callNode)) {
            context.report({
              node: callNode,
              messageId: 'missingCommandDescription',
              data: { name: info.name }
            });
          }
        }
      }
    };
  }
};
