/**
 * Prettier Configuration for Task Management App
 * Consistent code formatting across all files
 */

module.exports = {
  // Basic formatting
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  quoteProps: 'as-needed',
  trailingComma: 'es5',
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'avoid',
  endOfLine: 'lf',

  // Language-specific overrides
  overrides: [
    // TypeScript and JavaScript
    {
      files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
      options: {
        parser: 'typescript',
        singleQuote: true,
        trailingComma: 'es5',
      },
    },

    // JSON files
    {
      files: ['*.json', '*.jsonc'],
      options: {
        parser: 'json',
        tabWidth: 2,
        trailingComma: 'none',
      },
    },

    // Markdown files
    {
      files: ['*.md', '*.mdx'],
      options: {
        parser: 'markdown',
        printWidth: 80,
        proseWrap: 'always',
        tabWidth: 2,
      },
    },

    // YAML files
    {
      files: ['*.yml', '*.yaml'],
      options: {
        parser: 'yaml',
        tabWidth: 2,
        singleQuote: false,
      },
    },

    // CSS, SCSS, and Less
    {
      files: ['*.css', '*.scss', '*.less'],
      options: {
        parser: 'css',
        singleQuote: false,
      },
    },

    // HTML files
    {
      files: ['*.html'],
      options: {
        parser: 'html',
        printWidth: 120,
        tabWidth: 2,
        bracketSameLine: true,
      },
    },

    // Vue files
    {
      files: ['*.vue'],
      options: {
        parser: 'vue',
      },
    },

    // GraphQL files
    {
      files: ['*.graphql', '*.gql'],
      options: {
        parser: 'graphql',
      },
    },

    // Package.json files (special formatting)
    {
      files: ['package.json'],
      options: {
        parser: 'json-stringify',
        tabWidth: 2,
        trailingComma: 'none',
      },
    },

    // Configuration files
    {
      files: [
        '.eslintrc.js',
        '.eslintrc.json',
        'prettier.config.js',
        'tailwind.config.js',
        'next.config.js',
        'vite.config.js',
        'webpack.config.js',
        'rollup.config.js',
        'jest.config.js',
        'vitest.config.js',
      ],
      options: {
        parser: 'babel',
        singleQuote: true,
        trailingComma: 'es5',
      },
    },

    // Docker files
    {
      files: ['Dockerfile*', '*.dockerfile'],
      options: {
        parser: 'sh',
      },
    },

    // Shell scripts
    {
      files: ['*.sh', '*.bash', '*.zsh'],
      options: {
        parser: 'sh',
        tabWidth: 2,
      },
    },

    // SQL files
    {
      files: ['*.sql'],
      options: {
        parser: 'sql',
        tabWidth: 2,
        keywordCase: 'upper',
      },
    },

    // XML files
    {
      files: ['*.xml', '*.svg'],
      options: {
        parser: 'html',
        xmlWhitespaceSensitivity: 'ignore',
        bracketSameLine: true,
      },
    },

    // TOML files
    {
      files: ['*.toml'],
      options: {
        parser: 'toml',
      },
    },

    // Properties files
    {
      files: ['*.properties', '*.env*'],
      options: {
        parser: 'properties',
      },
    },
  ],

  // Plugin configurations
  plugins: [
    '@prettier/plugin-xml',
    'prettier-plugin-sql',
    'prettier-plugin-sh',
    'prettier-plugin-properties',
    'prettier-plugin-toml',
  ],

  // Ignore patterns (can also be in .prettierignore)
  ignorePath: '.prettierignore',
};