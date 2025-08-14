import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { testConfig } from './test-config';
import { DatabaseHelpers } from '../helpers/database-helpers';

// Global test setup
beforeAll(async () => {
  console.log('🚀 Starting test suite...');

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = testConfig.auth.jwtSecret;
  process.env.DATABASE_URL = testConfig.database.url;
  process.env.REDIS_URL = testConfig.redis.url;

  // Initialize test database
  try {
    await DatabaseHelpers.resetDatabase();
    console.log('✅ Test database initialized');
  } catch (error) {
    console.warn('⚠️  Could not initialize test database:', error);
  }
}, 30000);

afterAll(async () => {
  console.log('🧹 Cleaning up test suite...');

  try {
    await DatabaseHelpers.closeConnection();
    console.log('✅ Test cleanup completed');
  } catch (error) {
    console.warn('⚠️  Test cleanup failed:', error);
  }
});

// Test isolation setup
beforeEach(async () => {
  // Clean up before each test if configured
  if (testConfig.cleanup.afterEach) {
    try {
      await DatabaseHelpers.cleanupDatabase();
    } catch (error) {
      console.warn('⚠️  Test cleanup before test failed:', error);
    }
  }
});

afterEach(async () => {
  // Clean up after each test if configured
  if (testConfig.cleanup.afterEach) {
    try {
      await DatabaseHelpers.cleanupDatabase();
    } catch (error) {
      console.warn('⚠️  Test cleanup after test failed:', error);
    }
  }
});

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
});

// Extend expect with custom matchers
expect.extend({
  toBeValidId(received: string) {
    const pass = typeof received === 'string' && received.length > 0;
    return {
      message: () => `expected ${received} to be a valid ID`,
      pass,
    };
  },

  toBeValidEmail(received: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);
    return {
      message: () => `expected ${received} to be a valid email`,
      pass,
    };
  },

  toBeValidDate(received: any) {
    const date = new Date(received);
    const pass = !isNaN(date.getTime());
    return {
      message: () => `expected ${received} to be a valid date`,
      pass,
    };
  },

  toBeWithinTimeRange(
    received: Date,
    expected: Date,
    toleranceMs: number = 1000
  ) {
    const diff = Math.abs(received.getTime() - expected.getTime());
    const pass = diff <= toleranceMs;
    return {
      message: () =>
        `expected ${received} to be within ${toleranceMs}ms of ${expected}`,
      pass,
    };
  },

  toHaveValidStructure(received: any, expectedKeys: string[]) {
    const receivedKeys = Object.keys(received);
    const hasAllKeys = expectedKeys.every(key => receivedKeys.includes(key));
    return {
      message: () => `expected object to have keys: ${expectedKeys.join(', ')}`,
      pass: hasAllKeys,
    };
  },
});

// Declare custom matchers for TypeScript
declare global {
  namespace Vi {
    interface Assertion<T = any> {
      toBeValidId(): T;
      toBeValidEmail(): T;
      toBeValidDate(): T;
      toBeWithinTimeRange(expected: Date, toleranceMs?: number): T;
      toHaveValidStructure(expectedKeys: string[]): T;
    }
  }
}
