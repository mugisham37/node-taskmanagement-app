module.exports = {
  root: true,
  extends: ['@taskmanagement/eslint-config/node'],
  ignorePatterns: [
    'dist/',
    'build/',
    '.next/',
    'node_modules/',
    'coverage/',
    'packages/config/eslint-config/',
    'packages/config/prettier-config/',
    'packages/config/typescript-config/',
  ],
};