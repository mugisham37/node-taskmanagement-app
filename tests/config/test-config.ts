export const testConfig = {
  database: {
    url:
      process.env.TEST_DATABASE_URL ||
      'postgresql://test:test@localhost:5432/test_db',
    maxConnections: 10,
    connectionTimeout: 5000,
  },

  redis: {
    url: process.env.TEST_REDIS_URL || 'redis://localhost:6379/1',
    maxConnections: 5,
  },

  api: {
    baseUrl: process.env.TEST_API_URL || 'http://localhost:3000',
    timeout: 10000,
  },

  auth: {
    jwtSecret: 'test-jwt-secret-key-for-testing-only',
    tokenExpiry: '1h',
    refreshTokenExpiry: '7d',
  },

  performance: {
    maxResponseTime: 200, // milliseconds
    maxConcurrentRequests: 100,
    loadTestDuration: 30000, // 30 seconds
  },

  security: {
    rateLimitWindow: 60000, // 1 minute
    rateLimitMax: 100,
    maxRequestSize: '10mb',
    allowedOrigins: ['http://localhost:3000', 'http://localhost:3001'],
  },

  email: {
    testMode: true,
    smtpHost: 'localhost',
    smtpPort: 1025, // MailHog for testing
  },

  files: {
    uploadPath: './test-uploads',
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  },

  monitoring: {
    metricsEnabled: false,
    tracingEnabled: false,
    logLevel: 'error',
  },

  timeouts: {
    unit: 5000,
    integration: 15000,
    e2e: 30000,
    performance: 60000,
  },

  coverage: {
    threshold: {
      global: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    exclude: [
      'tests/**',
      'dist/**',
      'node_modules/**',
      '**/*.d.ts',
      '**/*.config.ts',
    ],
  },

  parallelism: {
    unit: 4,
    integration: 2,
    e2e: 1,
  },

  retries: {
    unit: 0,
    integration: 1,
    e2e: 2,
    performance: 0,
  },

  cleanup: {
    afterEach: true,
    afterAll: true,
    database: true,
    files: true,
    cache: true,
  },
};

export const getTestConfig = () => testConfig;

export const isCI = process.env.CI === 'true';
export const isDebug = process.env.DEBUG === 'true';
export const testEnvironment = process.env.TEST_ENV || 'local';
