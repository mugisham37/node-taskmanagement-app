import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/infrastructure/test-setup-enhanced.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        '**/*.d.ts',
        '**/*.config.ts',
        'tests/',
        'prisma/',
        'scripts/',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
      include: ['src/**/*.ts'],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        // Specific thresholds for critical components
        'src/domain/**/*.ts': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        'src/application/**/*.ts': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
      },
    },
    testTimeout: 30000, // 30 seconds for integration tests
    hookTimeout: 60000, // 60 seconds for setup/teardown
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 1,
        maxThreads: 4,
      },
    },
    // Test file patterns
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    exclude: ['node_modules/', 'dist/', 'coverage/'],
    // Reporter configuration
    reporter: ['verbose', 'json', 'html'],
    outputFile: {
      json: './test-results/results.json',
      html: './test-results/index.html',
    },
    // Retry configuration
    retry: {
      // Retry flaky tests up to 2 times
      count: 2,
    },
    // Bail configuration
    bail: 0, // Don't bail on first failure
    // Watch configuration
    watch: false,
    // Environment variables for tests
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      // Test-specific overrides
      JWT_SECRET:
        'test-jwt-secret-that-is-long-enough-for-validation-requirements',
      JWT_REFRESH_SECRET:
        'test-refresh-secret-that-is-long-enough-for-validation-requirements',
      SESSION_SECRET:
        'test-session-secret-that-is-long-enough-for-validation-requirements',
      CSRF_SECRET:
        'test-csrf-secret-that-is-long-enough-for-validation-requirements',
      WEBHOOK_SECRET:
        'test-webhook-secret-that-is-long-enough-for-validation-requirements',
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '../src'),
      '@tests': resolve(__dirname, '.'),
    },
  },
  // Esbuild configuration for TypeScript
  esbuild: {
    target: 'node18',
  },
});

// Test categories configuration
export const testCategories = {
  unit: {
    pattern: 'tests/unit/**/*.test.ts',
    timeout: 5000,
    description: 'Fast unit tests for individual components',
  },
  integration: {
    pattern: 'tests/integration/**/*.test.ts',
    timeout: 15000,
    description: 'Integration tests with external dependencies',
  },
  e2e: {
    pattern: 'tests/e2e/**/*.test.ts',
    timeout: 30000,
    description: 'End-to-end tests through the full application stack',
  },
  performance: {
    pattern: 'tests/e2e/performance/**/*.test.ts',
    timeout: 60000,
    description: 'Performance and load testing',
  },
  security: {
    pattern: 'tests/e2e/security/**/*.test.ts',
    timeout: 30000,
    description: 'Security and vulnerability testing',
  },
};

// Test environment configuration
export const testEnvironments = {
  development: {
    database:
      'postgresql://postgres:postgres@localhost:5432/unified_enterprise_platform_test',
    redis: 'redis://localhost:6379',
    containers: true,
  },
  ci: {
    database:
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432/unified_enterprise_platform_test',
    redis: process.env.REDIS_URL || 'redis://localhost:6379',
    containers: true,
    parallel: true,
    coverage: true,
  },
  docker: {
    database:
      'postgresql://postgres:postgres@postgres-test:5432/unified_enterprise_platform_test',
    redis: 'redis://redis-test:6379',
    containers: false, // Containers managed by docker-compose
  },
};

// Performance test thresholds
export const performanceThresholds = {
  api: {
    authentication: 200, // ms
    taskCreation: 200,
    taskListing: 300,
    taskSearch: 400,
    bulkOperations: 500,
    fileUpload: 1000,
    dashboard: 500,
  },
  database: {
    simpleQuery: 50, // ms
    complexQuery: 200,
    aggregation: 500,
    fullTextSearch: 300,
  },
  cache: {
    get: 10, // ms
    set: 20,
    delete: 15,
    pattern: 50,
  },
  memory: {
    maxIncrease: 50 * 1024 * 1024, // 50MB
    maxHeapUsed: 200 * 1024 * 1024, // 200MB
  },
};

// Test data configuration
export const testDataConfig = {
  users: {
    default: 10,
    performance: 100,
    load: 1000,
  },
  workspaces: {
    default: 3,
    performance: 10,
    load: 50,
  },
  projects: {
    default: 5,
    performance: 20,
    load: 100,
  },
  tasks: {
    default: 20,
    performance: 1000,
    load: 10000,
  },
};

// Mock configuration
export const mockConfig = {
  external: {
    email: true,
    sms: true,
    storage: true,
    webhooks: true,
    analytics: true,
  },
  internal: {
    cache: false, // Use real Redis in tests
    database: false, // Use real PostgreSQL in tests
    queue: true,
    scheduler: true,
  },
};

// Test utilities configuration
export const testUtilsConfig = {
  assertions: {
    strict: true,
    customMatchers: true,
    performance: true,
    security: true,
  },
  fixtures: {
    autoLoad: true,
    cleanup: true,
    isolation: true,
  },
  scenarios: {
    prebuilt: true,
    dynamic: true,
    cleanup: true,
  },
};

// Export all configurations
export default {
  testCategories,
  testEnvironments,
  performanceThresholds,
  testDataConfig,
  mockConfig,
  testUtilsConfig,
};
