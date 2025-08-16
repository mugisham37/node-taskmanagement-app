import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';

// Global test setup
beforeAll(async () => {
  // Setup test environment
  process.env.NODE_ENV = 'test';
  
  // Mock external dependencies if needed
  // Example: Mock Redis, Database connections, etc.
});

afterAll(async () => {
  // Cleanup after all tests
});

beforeEach(() => {
  // Reset mocks before each test
});

afterEach(() => {
  // Cleanup after each test
});

// Mock external services for testing
export const mockCacheService = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  delete: vi.fn(),
  increment: vi.fn(),
  expire: vi.fn(),
};

export const mockLoggingService = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  log: vi.fn(),
};

export const mockEmailService = {
  sendTwoFactorCode: vi.fn(),
  sendPasswordReset: vi.fn(),
  sendEmailVerification: vi.fn(),
};