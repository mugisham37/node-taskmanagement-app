module.exports = {
  extends: ['./index.js'],
  env: {
    node: true,
    es2022: true
  },
  rules: {
    // Node.js specific rules
    'no-console': 'off', // Console is acceptable in Node.js
    'no-process-env': 'off',
    'no-process-exit': 'error',
    'no-sync': 'warn',
    'global-require': 'error',
    'handle-callback-err': 'error',
    'no-mixed-requires': 'error',
    'no-new-require': 'error',
    'no-path-concat': 'error',
    'no-restricted-modules': 'off',

    // Import rules for Node.js
    'import/no-dynamic-require': 'warn',
    'import/no-nodejs-modules': 'off',

    // TypeScript rules for Node.js
    '@typescript-eslint/no-var-requires': 'error',
    '@typescript-eslint/prefer-readonly-parameter-types': 'off'
  },
  overrides: [
    {
      files: ['**/*.config.ts', '**/*.config.js', '**/scripts/**/*.ts', '**/scripts/**/*.js'],
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        'import/no-dynamic-require': 'off'
      }
    },
    {
      files: ['**/migrations/**/*.ts', '**/seeds/**/*.ts'],
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-explicit-any': 'off'
      }
    }
  ]
};