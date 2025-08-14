import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';

// Global test setup
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';

  // Ensure test database is available
  if (process.env.CI !== 'true') {
    try {
      // Start test containers if not in CI
      if (!existsSync('.test-containers-started')) {
        console.log('🐳 Starting test containers...');
        execSync('docker-compose -f docker-compose.test.yml up -d --wait', {
          stdio: 'inherit',
        });
        // Create marker file
        execSync('touch .test-containers-started');
      }
    } catch (error) {
      console.warn('⚠️  Could not start test containers:', error);
    }
  }
});

afterAll(async () => {
  // Cleanup test containers if not in CI
  if (process.env.CI !== 'true') {
    try {
      if (existsSync('.test-containers-started')) {
        console.log('🧹 Cleaning up test containers...');
        execSync('docker-compose -f docker-compose.test.yml down -v', {
          stdio: 'inherit',
        });
        execSync('rm -f .test-containers-started');
      }
    } catch (error) {
      console.warn('⚠️  Could not cleanup test containers:', error);
    }
  }
});

// Test isolation setup
beforeEach(async () => {
  // Clear any test data before each test
  // This will be implemented per test category
});

afterEach(async () => {
  // Cleanup after each test
  // This will be implemented per test category
});
