module.exports = {
  '*.{ts,tsx,js,jsx}': [
    'eslint --fix',
    'prettier --write',
    () => 'npm run type-check',
  ],
  '*.{json,md,yml,yaml}': ['prettier --write'],
  '*.{css,scss,sass}': ['prettier --write'],
  'package.json': ['prettier --write'],
  '*.{ts,tsx}': [
    () => 'npm run test:unit -- --passWithNoTests --findRelatedTests',
  ],
};