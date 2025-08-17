import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  
  test: {
    // Test environment
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tools/testing/setup.ts'],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'dist/',
        'build/',
        '.next/',
        'coverage/',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/*.stories.{js,ts,jsx,tsx}',
        '**/test/**',
        '**/tests/**',
        '**/__tests__/**',
        '**/*.test.{js,ts,jsx,tsx}',
        '**/*.spec.{js,ts,jsx,tsx}',
        'tools/',
        'scripts/',
        'docs/',
      ],
      include: [
        'packages/*/src/**/*.{js,ts,jsx,tsx}',
        'apps/*/src/**/*.{js,ts,jsx,tsx}',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        // Package-specific thresholds
        'packages/core/': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        'packages/domain/': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
        'packages/validation/': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95,
        },
      },
    },
    
    // Test file patterns
    include: [
      '**/*.{test,spec}.{js,ts,jsx,tsx}',
      '**/test/**/*.{js,ts,jsx,tsx}',
      '**/__tests__/**/*.{js,ts,jsx,tsx}',
    ],
    exclude: [
      'node_modules/',
      'dist/',
      'build/',
      '.next/',
      'coverage/',
      'e2e/',
      '**/*.e2e.{js,ts}',
    ],
    
    // Test timeout
    testTimeout: 10000,
    hookTimeout: 10000,
    
    // Reporters
    reporter: ['verbose', 'json', 'html'],
    outputFile: {
      json: './test-results/results.json',
      html: './test-results/index.html',
    },
    
    // Watch mode
    watch: false,
    
    // Parallel execution
    threads: true,
    maxThreads: 4,
    minThreads: 1,
    
    // Mock configuration
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    
    // Snapshot configuration
    resolveSnapshotPath: (testPath, snapExtension) => {
      return testPath.replace(/\.test\.([tj]sx?)/, `.test.${snapExtension}`);
    },
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, '../../src'),
      '@taskmanagement/core': resolve(__dirname, '../../packages/core/src'),
      '@taskmanagement/types': resolve(__dirname, '../../packages/types/src'),
      '@taskmanagement/validation': resolve(__dirname, '../../packages/validation/src'),
      '@taskmanagement/utils': resolve(__dirname, '../../packages/utils/src'),
      '@taskmanagement/domain': resolve(__dirname, '../../packages/domain/src'),
      '@taskmanagement/database': resolve(__dirname, '../../packages/database/src'),
      '@taskmanagement/auth': resolve(__dirname, '../../packages/auth/src'),
      '@taskmanagement/cache': resolve(__dirname, '../../packages/cache/src'),
      '@taskmanagement/events': resolve(__dirname, '../../packages/events/src'),
      '@taskmanagement/config': resolve(__dirname, '../../packages/config/src'),
      '@taskmanagement/i18n': resolve(__dirname, '../../packages/i18n/src'),
      '@taskmanagement/ui': resolve(__dirname, '../../packages/ui/src'),
    },
  },
  
  define: {
    __TEST__: true,
    __DEV__: true,
  },
});