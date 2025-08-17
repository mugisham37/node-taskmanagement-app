import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    globals: true,
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**',
        '**/dist/**',
        '**/.next/**',
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
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/store': path.resolve(__dirname, './src/store'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/config': path.resolve(__dirname, './src/config'),
      '@/styles': path.resolve(__dirname, './src/styles'),
      '@taskmanagement/auth': path.resolve(__dirname, '../../packages/auth/src'),
      '@taskmanagement/types': path.resolve(__dirname, '../../packages/types/src'),
      '@taskmanagement/validation': path.resolve(__dirname, '../../packages/validation/src'),
      '@taskmanagement/ui': path.resolve(__dirname, '../../packages/ui/src'),
      '@taskmanagement/i18n': path.resolve(__dirname, '../../packages/i18n/src'),
      '@taskmanagement/utils': path.resolve(__dirname, '../../packages/utils/src'),
      '@taskmanagement/config': path.resolve(__dirname, '../../packages/config/src'),
    },
  },
});