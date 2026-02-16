/**
 * ESLint Rule: no-hardcoded-credentials
 *
 * Detects potential hardcoded credentials, API keys, and secrets.
 *
 * This rule catches common patterns in AI-generated code where
 * secrets might be accidentally committed:
 * - API keys assigned to variables
 * - Password strings in code
 * - Private keys or tokens
 *
 * Credentials should be loaded from environment variables or
 * secure configuration files.
 */

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow hardcoded credentials, API keys, and secrets',
      category: 'Security',
      recommended: true
    },
    messages: {
      hardcodedCredential: 'Possible hardcoded {{type}} detected. Use environment variables instead.',
      suspiciousAssignment: 'Variable "{{name}}" may contain a secret. Consider using process.env.{{envVar}}.'
    },
    schema: [
      {
        type: 'object',
        properties: {
          sensitiveNames: {
            type: 'array',
            items: { type: 'string' },
            description: 'Additional variable names to check (case-insensitive regex patterns)'
          },
          minSecretLength: {
            type: 'integer',
            description: 'Minimum string length to consider as potential secret',
            default: 8
          },
          allowTestFiles: {
            type: 'boolean',
            description: 'Allow hardcoded values in test files',
            default: true
          }
        },
        additionalProperties: false
      }
    ]
  },

  create(context) {
    const options = context.options[0] || {};
    const minSecretLength = options.minSecretLength ?? 8;
    const allowTestFiles = options.allowTestFiles !== false;

    const filename = context.filename || context.getFilename();

    // Skip test files if allowed
    if (allowTestFiles) {
      if (
        filename.includes('.test.') ||
        filename.includes('.spec.') ||
        filename.includes('/tests/') ||
        filename.includes('/__tests__/')
      ) {
        return {};
      }
    }

    // Sensitive variable name patterns
    const defaultSensitivePatterns = [
      'api[_-]?key',
      'apikey',
      'secret',
      'password',
      'passwd',
      'pwd',
      'token',
      'auth[_-]?token',
      'access[_-]?token',
      'refresh[_-]?token',
      'bearer',
      'credential',
      'private[_-]?key',
      'client[_-]?secret',
      'client[_-]?id',
      'app[_-]?secret',
      'signing[_-]?key',
      'encryption[_-]?key',
      'jwt[_-]?secret',
      'session[_-]?secret',
      'database[_-]?url',
      'db[_-]?password',
      'connection[_-]?string'
    ];

    const customPatterns = options.sensitiveNames || [];
    const allPatterns = [...defaultSensitivePatterns, ...customPatterns];
    const sensitiveRegex = new RegExp(
      `(${allPatterns.join('|')})`,
      'i'
    );

    // Patterns that look like secrets (high entropy, specific formats)
    const secretPatterns = [
      // API key formats (various services)
      /^[A-Za-z0-9]{32,}$/,
      // AWS access key
      /^AKIA[0-9A-Z]{16}$/,
      // AWS secret key pattern
      /^[A-Za-z0-9/+=]{40}$/,
      // GitHub token
      /^gh[ps]_[A-Za-z0-9]{36,}$/,
      // Generic token pattern
      /^[a-f0-9]{32,64}$/,
      // Base64 encoded strings (often secrets)
      /^[A-Za-z0-9+/]{20,}={0,2}$/,
      // JWT-like pattern
      /^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
    ];

    /**
     * Check if a string looks like a secret
     */
    function looksLikeSecret(value) {
      if (typeof value !== 'string') return false;
      if (value.length < minSecretLength) return false;

      // Check against known secret patterns
      return secretPatterns.some(pattern => pattern.test(value));
    }

    /**
     * Convert variable name to suggested env var name
     */
    function toEnvVarName(name) {
      return name
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/[-\s]/g, '_')
        .toUpperCase();
    }

    /**
     * Get the type of credential based on variable name
     */
    function getCredentialType(name) {
      const lower = name.toLowerCase();
      if (lower.includes('key')) return 'API key';
      if (lower.includes('password') || lower.includes('passwd') || lower.includes('pwd')) return 'password';
      if (lower.includes('token')) return 'token';
      if (lower.includes('secret')) return 'secret';
      if (lower.includes('credential')) return 'credential';
      return 'credential';
    }

    return {
      VariableDeclarator(node) {
        // Check variable name against sensitive patterns
        if (node.id.type !== 'Identifier') return;

        const varName = node.id.name;
        const isSensitiveName = sensitiveRegex.test(varName);

        if (!isSensitiveName) return;

        // Check if assigned a literal string
        if (node.init && node.init.type === 'Literal' && typeof node.init.value === 'string') {
          const value = node.init.value;

          // Skip empty strings and obvious placeholders
          if (
            value === '' ||
            value.startsWith('$') ||
            value.startsWith('{{') ||
            value.includes('YOUR_') ||
            value.includes('REPLACE_') ||
            value === 'undefined' ||
            value === 'null' ||
            value === 'test' ||
            value === 'development' ||
            value === 'production'
          ) {
            return;
          }

          // Check if value looks like a real secret
          if (value.length >= minSecretLength) {
            context.report({
              node: node.init,
              messageId: 'suspiciousAssignment',
              data: {
                name: varName,
                envVar: toEnvVarName(varName)
              }
            });
          }
        }

        // Check template literals
        if (node.init && node.init.type === 'TemplateLiteral') {
          // If it's a simple template with no expressions, check the value
          if (node.init.expressions.length === 0 && node.init.quasis.length === 1) {
            const value = node.init.quasis[0].value.cooked;
            if (value && value.length >= minSecretLength) {
              context.report({
                node: node.init,
                messageId: 'suspiciousAssignment',
                data: {
                  name: varName,
                  envVar: toEnvVarName(varName)
                }
              });
            }
          }
        }
      },

      AssignmentExpression(node) {
        // Check property assignments like obj.apiKey = "..."
        if (node.left.type !== 'MemberExpression') return;
        if (node.left.property.type !== 'Identifier') return;

        const propName = node.left.property.name;
        const isSensitiveName = sensitiveRegex.test(propName);

        if (!isSensitiveName) return;

        if (node.right.type === 'Literal' && typeof node.right.value === 'string') {
          const value = node.right.value;

          if (value.length >= minSecretLength && looksLikeSecret(value)) {
            context.report({
              node: node.right,
              messageId: 'hardcodedCredential',
              data: { type: getCredentialType(propName) }
            });
          }
        }
      },

      Property(node) {
        // Check object properties like { apiKey: "..." }
        if (node.key.type !== 'Identifier') return;

        const propName = node.key.name;
        const isSensitiveName = sensitiveRegex.test(propName);

        if (!isSensitiveName) return;

        if (node.value.type === 'Literal' && typeof node.value.value === 'string') {
          const value = node.value.value;

          // Skip placeholders
          if (
            value === '' ||
            value.startsWith('$') ||
            value.startsWith('{{') ||
            value.includes('YOUR_') ||
            value.includes('REPLACE_')
          ) {
            return;
          }

          if (value.length >= minSecretLength) {
            context.report({
              node: node.value,
              messageId: 'suspiciousAssignment',
              data: {
                name: propName,
                envVar: toEnvVarName(propName)
              }
            });
          }
        }
      }
    };
  }
};
