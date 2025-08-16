module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'build',
        'chore',
        'ci',
        'docs',
        'feat',
        'fix',
        'perf',
        'refactor',
        'revert',
        'style',
        'test',
        'security',
        'deps',
      ],
    ],
    'scope-enum': [
      2,
      'always',
      [
        // Applications
        'api',
        'web',
        'admin',
        'mobile',
        
        // Packages
        'core',
        'types',
        'validation',
        'utils',
        'config',
        'i18n',
        'domain',
        'auth',
        'database',
        'cache',
        'events',
        'observability',
        'integrations',
        'jobs',
        'ui',
        
        // Infrastructure
        'infra',
        'k8s',
        'docker',
        'terraform',
        'helm',
        'monitoring',
        
        // Tooling
        'build',
        'ci',
        'deps',
        'docs',
        'testing',
        'linting',
        
        // General
        'workspace',
        'release',
      ],
    ],
    'scope-case': [2, 'always', 'lower-case'],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    'header-max-length': [2, 'always', 100],
    'body-leading-blank': [1, 'always'],
    'body-max-line-length': [2, 'always', 100],
    'footer-leading-blank': [1, 'always'],
    'footer-max-line-length': [2, 'always', 100],
  },
};