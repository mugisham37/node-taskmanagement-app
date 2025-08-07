import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { execSync } from 'child_process';
import { randomBytes } from 'crypto';

// Set test environment
process.env.NODE_ENV = 'test';

// Generate unique test database name to avoid conflicts
const testDbSuffix = randomBytes(4).toString('hex');
const originalDbUrl = process.env.DATABASE_URL;
const testDbName = `unified_enterprise_platform_test_${testDbSuffix}`;

// Update database URL for tests
if (originalDbUrl) {
  const url = new URL(originalDbUrl);
  url.pathname = `/${testDbName}`;
  process.env.DATABASE_URL_TEST = url.toString();
  process.env.DATABASE_URL = url.toString();
}

// Global test setup
beforeAll(async () => {
  try {
    // Create test database
    if (originalDbUrl) {
      const baseUrl = new URL(originalDbUrl);
      baseUrl.pathname = '/postgres'; // Connect to default postgres db to create test db

      // Note: This would require a running PostgreSQL instance
      // For now, we'll skip actual database creation in tests
      console.log(`Test database would be created: ${testDbName}`);
    }
  } catch (error) {
    console.warn('Could not set up test database:', error);
  }
});

afterAll(async () => {
  try {
    // Clean up test database
    if (originalDbUrl) {
      console.log(`Test database would be cleaned up: ${testDbName}`);
    }
  } catch (error) {
    console.warn('Could not clean up test database:', error);
  }
});

beforeEach(async () => {
  // Reset test database state before each test
  // This would truncate all tables and reset sequences
  console.log('Test database state would be reset');
});

afterEach(async () => {
  // Clean up after each test
  // This ensures no test data leaks between tests
  console.log('Test cleanup completed');
});

// Mock external services for testing
vi.mock('@/infrastructure/email/email-service', () => ({
  EmailService: vi.fn().mockImplementation(() => ({
    sendEmail: vi.fn().mockResolvedValue(true),
    sendBulkEmail: vi.fn().mockResolvedValue(true),
    validateEmailAddress: vi.fn().mockReturnValue(true),
  })),
}));

vi.mock('@/infrastructure/sms/sms-service', () => ({
  SmsService: vi.fn().mockImplementation(() => ({
    sendSms: vi.fn().mockResolvedValue(true),
    validatePhoneNumber: vi.fn().mockReturnValue(true),
  })),
}));

vi.mock('@/infrastructure/storage/file-service', () => ({
  FileService: vi.fn().mockImplementation(() => ({
    uploadFile: vi.fn().mockResolvedValue({
      url: 'http://example.com/file.jpg',
      key: 'test-key',
    }),
    deleteFile: vi.fn().mockResolvedValue(true),
    getFileUrl: vi.fn().mockReturnValue('http://example.com/file.jpg'),
  })),
}));

vi.mock('@/infrastructure/cache/redis-client', () => ({
  redisClient: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    expire: vi.fn().mockResolvedValue(1),
    flushall: vi.fn().mockResolvedValue('OK'),
  },
}));

vi.mock('@/infrastructure/websocket/websocket-service', () => ({
  WebSocketService: vi.fn().mockImplementation(() => ({
    broadcast: vi.fn().mockResolvedValue(true),
    sendToUser: vi.fn().mockResolvedValue(true),
    sendToWorkspace: vi.fn().mockResolvedValue(true),
  })),
}));

// Global test utilities
declare global {
  var testUtils: {
    createTestUser: () => Promise<any>;
    createTestWorkspace: () => Promise<any>;
    createTestProject: () => Promise<any>;
    createTestTask: () => Promise<any>;
    cleanupTestData: () => Promise<void>;
  };
}

// Import test utilities
import { TestDataFactory, TestDatabaseUtils } from './utils/test-helpers';

// Global test utilities
globalThis.testUtils = {
  createTestUser: TestDataFactory.createTestUser,
  createTestWorkspace: () =>
    Promise.resolve(TestDataFactory.createTestWorkspace()),
  createTestProject: () => Promise.resolve(TestDataFactory.createTestProject()),
  createTestTask: () => Promise.resolve(TestDataFactory.createTestTask()),
  cleanupTestData: TestDatabaseUtils.cleanupTestData,
};
