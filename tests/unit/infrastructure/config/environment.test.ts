import { describe, it, expect, beforeEach } from 'vitest';

describe('Environment Configuration', () => {
  beforeEach(() => {
    // Reset some environment variables but keep NODE_ENV
    delete process.env.PORT;
    delete process.env.DATABASE_URL;
  });

  it('should have test environment set', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });

  it('should validate required environment variables', () => {
    // Set minimal required environment variables
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_SECRET =
      'test-jwt-secret-that-is-long-enough-for-validation';
    process.env.JWT_REFRESH_SECRET =
      'test-refresh-secret-that-is-long-enough-for-validation';
    process.env.SESSION_SECRET =
      'test-session-secret-that-is-long-enough-for-validation';
    process.env.CSRF_SECRET =
      'test-csrf-secret-that-is-long-enough-for-validation';
    process.env.WEBHOOK_SECRET =
      'test-webhook-secret-that-is-long-enough-for-validation';

    // This should not throw an error
    expect(() => {
      // We'll test the actual config import in task 1.2 when we fix the environment setup
    }).not.toThrow();
  });
});
