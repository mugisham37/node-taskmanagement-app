import { beforeAll, afterAll, beforeEach, afterEach, vi, expect } from 'vitest';
import { testContainerManager } from './test-containers';
import { TestDatabaseUtils } from './test-database-utils';
import { TestScenarios } from './test-scenarios';
import { customMatchers } from './test-assertions';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

// Extend Vitest matchers
expect.extend(customMatchers);

// Global test state
interface TestContext {
  containers: {
    postgres?: any;
    redis?: any;
    mailhog?: any;
    minio?: any;
    elasticsearch?: any;
    webhookSite?: any;
  };
  clients: {
    redis?: Redis;
    prisma?: PrismaClient;
  };
  scenarios?: TestScenarios;
  databaseUrl?: string;
  performance: {
    startTime?: number;
    memoryUsage?: NodeJS.MemoryUsage;
  };
}

const testContext: TestContext = {
  containers: {},
  clients: {},
  performance: {},
};

// Enhanced global test setup
beforeAll(async () => {
  console.log('🚀 Starting test infrastructure...');

  try {
    // Start all test containers
    const containers = await testContainerManager.startAll();
    testContext.containers = containers;

    // Initialize database
    testContext.databaseUrl =
      testContainerManager.getConnectionString('postgres');
    TestDatabaseUtils.initialize(testContext.databaseUrl);

    // Initialize Prisma client
    testContext.clients.prisma = new PrismaClient({
      datasources: {
        db: {
          url: testContext.databaseUrl,
        },
      },
    });

    // Initialize test scenarios
    testContext.scenarios = new TestScenarios(testContext.clients.prisma);

    // Initialize Redis client
    const redisConfig = testContainerManager.getRedisConfig();
    testContext.clients.redis = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });

    // Set environment variables for tests
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = testContext.databaseUrl;
    process.env.REDIS_URL = `redis://${redisConfig.host}:${redisConfig.port}`;

    const mailhogConfig = testContainerManager.getMailHogConfig();
    process.env.SMTP_HOST = mailhogConfig.smtpHost;
    process.env.SMTP_PORT = mailhogConfig.smtpPort.toString();
    process.env.MAILHOG_URL = mailhogConfig.httpUrl;

    // Test secrets for JWT and other services
    process.env.JWT_SECRET =
      'test-jwt-secret-that-is-long-enough-for-validation-requirements';
    process.env.JWT_REFRESH_SECRET =
      'test-refresh-secret-that-is-long-enough-for-validation-requirements';
    process.env.SESSION_SECRET =
      'test-session-secret-that-is-long-enough-for-validation-requirements';
    process.env.CSRF_SECRET =
      'test-csrf-secret-that-is-long-enough-for-validation-requirements';
    process.env.WEBHOOK_SECRET =
      'test-webhook-secret-that-is-long-enough-for-validation-requirements';

    console.log('✅ Test infrastructure started successfully');
  } catch (error) {
    console.error('❌ Failed to start test infrastructure:', error);
    throw error;
  }
}, 60000); // 60 second timeout for container startup

afterAll(async () => {
  console.log('🧹 Cleaning up test infrastructure...');

  try {
    // Close Redis client
    if (testContext.clients.redis) {
      await testContext.clients.redis.quit();
    }

    // Close database connections
    await TestDatabaseUtils.cleanup();

    // Stop all containers
    await testContainerManager.cleanup();

    console.log('✅ Test infrastructure cleaned up successfully');
  } catch (error) {
    console.error('❌ Failed to cleanup test infrastructure:', error);
  }
});

beforeEach(async () => {
  // Record performance metrics
  testContext.performance.startTime = Date.now();
  testContext.performance.memoryUsage = process.memoryUsage();

  // Reset database state before each test
  await TestDatabaseUtils.resetDatabase();

  // Clear Redis cache
  if (testContext.clients.redis) {
    await testContext.clients.redis.flushall();
  }

  // Reset all mocks
  vi.clearAllMocks();
});

afterEach(async () => {
  // Log performance metrics
  if (testContext.performance.startTime) {
    const duration = Date.now() - testContext.performance.startTime;
    const currentMemory = process.memoryUsage();
    const memoryDiff =
      currentMemory.heapUsed -
      (testContext.performance.memoryUsage?.heapUsed || 0);

    if (duration > 5000) {
      // Log slow tests (>5s)
      console.warn(`⚠️  Slow test detected: ${duration}ms`);
    }

    if (memoryDiff > 50 * 1024 * 1024) {
      // Log high memory usage (>50MB)
      console.warn(
        `⚠️  High memory usage: ${Math.round(memoryDiff / 1024 / 1024)}MB`
      );
    }
  }

  // Additional cleanup after each test if needed
  vi.restoreAllMocks();
});

// Enhanced mock factories with better type safety
export const createMockServices = () => ({
  // Authentication service mock
  authService: {
    authenticate: vi.fn(),
    register: vi.fn(),
    validateToken: vi.fn(),
    refreshToken: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
    resetPassword: vi.fn(),
    enableMfa: vi.fn(),
    disableMfa: vi.fn(),
    verifyMfa: vi.fn(),
    generateBackupCodes: vi.fn(),
    validateBackupCode: vi.fn(),
  },

  // Task service mock
  taskService: {
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    getTask: vi.fn(),
    getTasks: vi.fn(),
    assignTask: vi.fn(),
    unassignTask: vi.fn(),
    completeTask: vi.fn(),
    reopenTask: vi.fn(),
    addComment: vi.fn(),
    updateComment: vi.fn(),
    deleteComment: vi.fn(),
    addAttachment: vi.fn(),
    removeAttachment: vi.fn(),
    addWatcher: vi.fn(),
    removeWatcher: vi.fn(),
    moveTask: vi.fn(),
    duplicateTask: vi.fn(),
  },

  // Workspace service mock
  workspaceService: {
    createWorkspace: vi.fn(),
    updateWorkspace: vi.fn(),
    deleteWorkspace: vi.fn(),
    getWorkspace: vi.fn(),
    getUserWorkspaces: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    updateMemberRole: vi.fn(),
    inviteMember: vi.fn(),
    acceptInvitation: vi.fn(),
    rejectInvitation: vi.fn(),
    updateSettings: vi.fn(),
    updateBranding: vi.fn(),
  },

  // Project service mock
  projectService: {
    createProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
    getProject: vi.fn(),
    getProjects: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    updateMemberRole: vi.fn(),
    archiveProject: vi.fn(),
    unarchiveProject: vi.fn(),
    duplicateProject: vi.fn(),
  },

  // Notification service mock
  notificationService: {
    sendNotification: vi.fn(),
    sendBulkNotifications: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    getUserNotifications: vi.fn(),
    updatePreferences: vi.fn(),
    deleteNotification: vi.fn(),
    getUnreadCount: vi.fn(),
  },

  // Email service mock
  emailService: {
    sendEmail: vi.fn(),
    sendBulkEmail: vi.fn(),
    validateEmailAddress: vi.fn(),
    sendWelcomeEmail: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
    sendTaskAssignmentEmail: vi.fn(),
    sendTaskUpdateEmail: vi.fn(),
    sendInvitationEmail: vi.fn(),
    sendDigestEmail: vi.fn(),
  },

  // File service mock
  fileService: {
    uploadFile: vi.fn(),
    deleteFile: vi.fn(),
    getFileUrl: vi.fn(),
    getFileMetadata: vi.fn(),
    scanForViruses: vi.fn(),
    generateThumbnail: vi.fn(),
    processImage: vi.fn(),
  },

  // Cache service mock
  cacheService: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    expire: vi.fn(),
    flushall: vi.fn(),
    keys: vi.fn(),
    mget: vi.fn(),
    mset: vi.fn(),
    incr: vi.fn(),
    decr: vi.fn(),
  },

  // WebSocket service mock
  webSocketService: {
    broadcast: vi.fn(),
    sendToUser: vi.fn(),
    sendToWorkspace: vi.fn(),
    sendToProject: vi.fn(),
    addConnection: vi.fn(),
    removeConnection: vi.fn(),
    getConnectedUsers: vi.fn(),
    getUserPresence: vi.fn(),
    updatePresence: vi.fn(),
  },

  // Analytics service mock
  analyticsService: {
    trackEvent: vi.fn(),
    trackUserActivity: vi.fn(),
    getTaskMetrics: vi.fn(),
    getProjectMetrics: vi.fn(),
    getUserProductivity: vi.fn(),
    getWorkspaceAnalytics: vi.fn(),
    generateReport: vi.fn(),
  },

  // Audit service mock
  auditService: {
    logActivity: vi.fn(),
    logSecurityEvent: vi.fn(),
    getAuditTrail: vi.fn(),
    generateComplianceReport: vi.fn(),
    exportAuditLog: vi.fn(),
  },
});

// Global test utilities
declare global {
  var testContext: TestContext;
  var createMockServices: typeof createMockServices;
}

globalThis.testContext = testContext;
globalThis.createMockServices = createMockServices;

// Export test context and utilities
export { testContext, createMockServices };
export { TestDatabaseUtils } from './test-database-utils';
export { testContainerManager } from './test-containers';
export * from './test-data-builders';
