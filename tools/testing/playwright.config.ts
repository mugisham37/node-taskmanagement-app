import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for E2E Testing
 * Cross-browser testing with comprehensive coverage
 */

// Use process.env.PORT by default and fallback to port 3000
const PORT = process.env.PORT || 3000;

// Set webServer.url and use.baseURL with the location of the WebServer respecting the correct set port
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  // Test directory
  testDir: './tests/e2e',
  
  // Global test timeout
  timeout: 30 * 1000,
  
  // Expect timeout for assertions
  expect: {
    timeout: 5 * 1000,
  },
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'test-results/playwright-report' }],
    ['json', { outputFile: 'test-results/playwright-results.json' }],
    ['junit', { outputFile: 'test-results/playwright-results.xml' }],
    process.env.CI ? ['github'] : ['list'],
  ],
  
  // Global setup and teardown
  globalSetup: require.resolve('./global-setup.ts'),
  globalTeardown: require.resolve('./global-teardown.ts'),
  
  // Shared settings for all projects
  use: {
    // Base URL for all tests
    baseURL,
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Record video on failure
    video: 'retain-on-failure',
    
    // Take screenshot on failure
    screenshot: 'only-on-failure',
    
    // Ignore HTTPS errors
    ignoreHTTPSErrors: true,
    
    // Default navigation timeout
    navigationTimeout: 30 * 1000,
    
    // Default action timeout
    actionTimeout: 10 * 1000,
    
    // Locale and timezone
    locale: 'en-US',
    timezoneId: 'America/New_York',
    
    // Viewport size
    viewport: { width: 1280, height: 720 },
    
    // User agent
    userAgent: 'TaskManagement-E2E-Tests',
    
    // Extra HTTP headers
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
    
    // Storage state for authenticated tests
    storageState: {
      cookies: [],
      origins: [],
    },
  },

  // Configure projects for major browsers
  projects: [
    // Setup project for authentication
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      teardown: 'cleanup',
    },
    
    // Cleanup project
    {
      name: 'cleanup',
      testMatch: /.*\.teardown\.ts/,
    },

    // Desktop browsers
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Use prepared auth state
        storageState: 'test-results/auth/user.json',
      },
      dependencies: ['setup'],
    },

    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        storageState: 'test-results/auth/user.json',
      },
      dependencies: ['setup'],
    },

    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        storageState: 'test-results/auth/user.json',
      },
      dependencies: ['setup'],
    },

    // Mobile browsers
    {
      name: 'Mobile Chrome',
      use: { 
        ...devices['Pixel 5'],
        storageState: 'test-results/auth/user.json',
      },
      dependencies: ['setup'],
    },

    {
      name: 'Mobile Safari',
      use: { 
        ...devices['iPhone 12'],
        storageState: 'test-results/auth/user.json',
      },
      dependencies: ['setup'],
    },

    // Tablet browsers
    {
      name: 'Tablet Chrome',
      use: { 
        ...devices['iPad Pro'],
        storageState: 'test-results/auth/user.json',
      },
      dependencies: ['setup'],
    },

    // Edge browser
    {
      name: 'Microsoft Edge',
      use: { 
        ...devices['Desktop Edge'],
        channel: 'msedge',
        storageState: 'test-results/auth/user.json',
      },
      dependencies: ['setup'],
    },

    // Google Chrome
    {
      name: 'Google Chrome',
      use: { 
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        storageState: 'test-results/auth/user.json',
      },
      dependencies: ['setup'],
    },

    // Branded tests (without authentication)
    {
      name: 'chromium-no-auth',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /.*\.noauth\.spec\.ts/,
    },

    // API testing
    {
      name: 'api',
      use: {
        baseURL: `http://localhost:4000`,
      },
      testMatch: /.*\.api\.spec\.ts/,
    },

    // Visual regression testing
    {
      name: 'visual',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: 'test-results/auth/user.json',
      },
      dependencies: ['setup'],
      testMatch: /.*\.visual\.spec\.ts/,
    },

    // Accessibility testing
    {
      name: 'accessibility',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: 'test-results/auth/user.json',
      },
      dependencies: ['setup'],
      testMatch: /.*\.a11y\.spec\.ts/,
    },

    // Performance testing
    {
      name: 'performance',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: 'test-results/auth/user.json',
      },
      dependencies: ['setup'],
      testMatch: /.*\.perf\.spec\.ts/,
    },
  ],

  // Web server configuration
  webServer: [
    // API server
    {
      command: 'pnpm --filter @taskmanagement/api run dev',
      port: 4000,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://test:test@localhost:5432/taskmanagement_test',
        REDIS_URL: 'redis://localhost:6379/1',
        JWT_SECRET: 'test-secret-key-for-e2e-tests',
      },
    },
    // Web application
    {
      command: 'pnpm --filter web run dev',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'test',
        NEXT_PUBLIC_API_URL: 'http://localhost:4000',
        NEXT_PUBLIC_WS_URL: 'ws://localhost:4000',
      },
    },
    // Admin application
    {
      command: 'pnpm --filter admin run dev',
      port: 3001,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'test',
        NEXT_PUBLIC_API_URL: 'http://localhost:4000',
        NEXT_PUBLIC_WS_URL: 'ws://localhost:4000',
      },
    },
  ],

  // Output directory
  outputDir: 'test-results/playwright-artifacts',
  
  // Test result directory
  testResultsDir: 'test-results/playwright-results',
  
  // Metadata
  metadata: {
    'test-environment': process.env.NODE_ENV || 'test',
    'base-url': baseURL,
    'browser-versions': 'latest',
    'test-runner': 'playwright',
  },
});