import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/setup.ts'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@taskmanagement/core': path.resolve(__dirname, '../core/src'),
      '@taskmanagement/types': path.resolve(__dirname, '../types/src'),
      '@taskmanagement/validation': path.resolve(__dirname, '../validation/src'),
      '@taskmanagement/cache': path.resolve(__dirname, '../cache/src'),
      '@taskmanagement/utils': path.resolve(__dirname, '../utils/src')
    }
  }
});