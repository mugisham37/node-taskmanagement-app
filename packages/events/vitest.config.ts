import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@taskmanagement/core': path.resolve(__dirname, '../core/src'),
      '@taskmanagement/domain': path.resolve(__dirname, '../domain/src'),
      '@taskmanagement/database': path.resolve(__dirname, '../database/src'),
      '@taskmanagement/cache': path.resolve(__dirname, '../cache/src'),
      '@taskmanagement/utils': path.resolve(__dirname, '../utils/src'),
      '@taskmanagement/integrations': path.resolve(__dirname, '../integrations/src'),
    }
  }
});