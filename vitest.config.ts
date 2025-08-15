import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup/vitest-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        '**/*.d.ts',
        '**/*.config.ts',
        'tests/',
        'scripts/',
        'drizzle/',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
      },
    },
    reporters: ['verbose', 'json'],
    outputFile: {
      json: './test-results/results.json',
    },
  },
  resolve: {
    alias: {
      '@taskmanagement/shared': resolve(__dirname, './packages/shared/src'),
      '@taskmanagement/database': resolve(__dirname, './packages/database/src'),
      '@taskmanagement/ui': resolve(__dirname, './packages/ui/src'),
      '@taskmanagement/config': resolve(__dirname, './packages/config/src'),
      '@taskmanagement/server': resolve(__dirname, './apps/server/src'),
      '@taskmanagement/client': resolve(__dirname, './apps/client/src'),
    },
  },
});