import { FastifyInstance } from 'fastify';
import { buildApp } from '@/app';
import { PrismaClient } from '@prisma/client';

let testServer: FastifyInstance | null = null;

export async function createTestServer(): Promise<FastifyInstance> {
  if (testServer) {
    return testServer;
  }

  // Use test database connection
  const testDatabaseUrl = globalThis.testContext.databaseUrl;
  const testRedisConfig = globalThis.testContext.clients.redis?.options;

  // Override environment variables for testing
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.REDIS_URL = `redis://${testRedisConfig?.host}:${testRedisConfig?.port}`;
  process.env.NODE_ENV = 'test';

  // Test-specific configuration
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

  // Email configuration for testing
  const mailhogConfig = globalThis.testContainerManager?.getMailHogConfig();
  if (mailhogConfig) {
    process.env.SMTP_HOST = mailhogConfig.smtpHost;
    process.env.SMTP_PORT = mailhogConfig.smtpPort.toString();
    process.env.SMTP_USER = '';
    process.env.SMTP_PASS = '';
    process.env.SMTP_FROM = 'test@example.com';
  }

  // File storage configuration for testing
  const minioConfig = globalThis.testContainerManager?.getMinIOConfig();
  if (minioConfig) {
    process.env.S3_ENDPOINT = minioConfig.endpoint;
    process.env.S3_ACCESS_KEY = minioConfig.accessKey;
    process.env.S3_SECRET_KEY = minioConfig.secretKey;
    process.env.S3_BUCKET = 'test-bucket';
    process.env.S3_REGION = 'us-east-1';
  }

  // Build the application
  testServer = await buildApp({
    logger: {
      level: 'silent', // Reduce log noise during tests
    },
  });

  // Initialize the server
  await testServer.ready();

  return testServer;
}

export async function closeTestServer(): Promise<void> {
  if (testServer) {
    await testServer.close();
    testServer = null;
  }
}

// Helper function to create authenticated request headers
export function createAuthHeaders(token: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  };
}

// Helper function to create test user and get auth token
export async function createAuthenticatedUser(
  server: FastifyInstance,
  userData: {
    email: string;
    name: string;
    password: string;
  }
): Promise<{
  user: any;
  accessToken: string;
  refreshToken: string;
}> {
  const registerResponse = await server.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      ...userData,
      confirmPassword: userData.password,
    },
  });

  if (registerResponse.statusCode !== 201) {
    throw new Error(`Failed to create test user: ${registerResponse.body}`);
  }

  const { user, accessToken, refreshToken } = registerResponse.json();
  return { user, accessToken, refreshToken };
}

// Helper function to create test workspace
export async function createTestWorkspace(
  server: FastifyInstance,
  authToken: string,
  workspaceData: {
    name: string;
    description?: string;
  }
): Promise<any> {
  const response = await server.inject({
    method: 'POST',
    url: '/api/workspaces',
    headers: createAuthHeaders(authToken),
    payload: workspaceData,
  });

  if (response.statusCode !== 201) {
    throw new Error(`Failed to create test workspace: ${response.body}`);
  }

  return response.json();
}

// Helper function to create test project
export async function createTestProject(
  server: FastifyInstance,
  authToken: string,
  workspaceId: string,
  projectData: {
    name: string;
    description?: string;
  }
): Promise<any> {
  const response = await server.inject({
    method: 'POST',
    url: `/api/workspaces/${workspaceId}/projects`,
    headers: createAuthHeaders(authToken),
    payload: projectData,
  });

  if (response.statusCode !== 201) {
    throw new Error(`Failed to create test project: ${response.body}`);
  }

  return response.json();
}

// Helper function to create test task
export async function createTestTask(
  server: FastifyInstance,
  authToken: string,
  workspaceId: string,
  projectId: string,
  taskData: {
    title: string;
    description?: string;
    priority?: string;
  }
): Promise<any> {
  const response = await server.inject({
    method: 'POST',
    url: `/api/workspaces/${workspaceId}/projects/${projectId}/tasks`,
    headers: createAuthHeaders(authToken),
    payload: taskData,
  });

  if (response.statusCode !== 201) {
    throw new Error(`Failed to create test task: ${response.body}`);
  }

  return response.json();
}

// Helper function to wait for async operations
export async function waitFor(
  condition: () => Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

// Helper function to simulate WebSocket connection
export async function createWebSocketConnection(
  server: FastifyInstance,
  authToken: string
): Promise<WebSocket> {
  // This would require WebSocket testing setup
  // For now, return a mock WebSocket
  return {
    send: (data: string) => console.log('Mock WebSocket send:', data),
    close: () => console.log('Mock WebSocket close'),
    addEventListener: (event: string, handler: Function) => {
      console.log(`Mock WebSocket addEventListener: ${event}`);
    },
    removeEventListener: (event: string, handler: Function) => {
      console.log(`Mock WebSocket removeEventListener: ${event}`);
    },
  } as any;
}

// Helper function to verify email was sent (using MailHog)
export async function verifyEmailSent(
  recipient: string,
  subject: string
): Promise<boolean> {
  const mailhogConfig = globalThis.testContainerManager?.getMailHogConfig();
  if (!mailhogConfig) {
    console.warn('MailHog not available for email verification');
    return false;
  }

  try {
    const response = await fetch(`${mailhogConfig.httpUrl}/api/v1/messages`);
    const messages = await response.json();

    return messages.items.some(
      (message: any) =>
        message.To.some((to: any) => to.Mailbox === recipient.split('@')[0]) &&
        message.Content.Headers.Subject[0].includes(subject)
    );
  } catch (error) {
    console.warn('Failed to verify email:', error);
    return false;
  }
}

// Helper function to clear all emails from MailHog
export async function clearEmails(): Promise<void> {
  const mailhogConfig = globalThis.testContainerManager?.getMailHogConfig();
  if (!mailhogConfig) {
    return;
  }

  try {
    await fetch(`${mailhogConfig.httpUrl}/api/v1/messages`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.warn('Failed to clear emails:', error);
  }
}

// Helper function to upload test file
export async function uploadTestFile(
  server: FastifyInstance,
  authToken: string,
  fileName: string,
  fileContent: Buffer,
  mimeType: string = 'text/plain'
): Promise<any> {
  const formData = new FormData();
  formData.append(
    'file',
    new Blob([fileContent], { type: mimeType }),
    fileName
  );

  const response = await server.inject({
    method: 'POST',
    url: '/api/files/upload',
    headers: {
      authorization: `Bearer ${authToken}`,
    },
    payload: formData,
  });

  if (response.statusCode !== 201) {
    throw new Error(`Failed to upload test file: ${response.body}`);
  }

  return response.json();
}

// Helper function to generate test data
export function generateTestData() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);

  return {
    email: `test${timestamp}${random}@example.com`,
    name: `Test User ${timestamp}`,
    password: 'TestPassword123!',
    workspaceName: `Test Workspace ${timestamp}`,
    projectName: `Test Project ${timestamp}`,
    taskTitle: `Test Task ${timestamp}`,
  };
}

// Helper function to assert response performance
export function assertResponseTime(
  startTime: number,
  maxTime: number,
  operation: string
): void {
  const duration = Date.now() - startTime;
  if (duration > maxTime) {
    console.warn(
      `Performance warning: ${operation} took ${duration}ms (max: ${maxTime}ms)`
    );
  }
  expect(duration).toBeLessThan(maxTime * 2); // Allow 2x buffer for CI environments
}

// Helper function to simulate concurrent requests
export async function simulateConcurrentRequests<T>(
  requestFactory: () => Promise<T>,
  concurrency: number = 10
): Promise<T[]> {
  const requests = Array.from({ length: concurrency }, () => requestFactory());
  return Promise.all(requests);
}

// Helper function to create test scenario data
export async function createCompleteTestScenario(
  server: FastifyInstance
): Promise<{
  users: Array<{ user: any; accessToken: string; refreshToken: string }>;
  workspace: any;
  projects: any[];
  tasks: any[];
}> {
  // Create multiple users
  const users = await Promise.all([
    createAuthenticatedUser(server, {
      email: 'owner@example.com',
      name: 'Workspace Owner',
      password: 'Password123!',
    }),
    createAuthenticatedUser(server, {
      email: 'admin@example.com',
      name: 'Workspace Admin',
      password: 'Password123!',
    }),
    createAuthenticatedUser(server, {
      email: 'member@example.com',
      name: 'Workspace Member',
      password: 'Password123!',
    }),
  ]);

  // Create workspace
  const workspace = await createTestWorkspace(server, users[0].accessToken, {
    name: 'E2E Test Workspace',
    description: 'Workspace for end-to-end testing',
  });

  // Create projects
  const projects = await Promise.all([
    createTestProject(server, users[0].accessToken, workspace.id, {
      name: 'Project Alpha',
      description: 'First test project',
    }),
    createTestProject(server, users[0].accessToken, workspace.id, {
      name: 'Project Beta',
      description: 'Second test project',
    }),
  ]);

  // Create tasks
  const tasks = await Promise.all([
    createTestTask(server, users[0].accessToken, workspace.id, projects[0].id, {
      title: 'Task 1',
      description: 'First test task',
      priority: 'HIGH',
    }),
    createTestTask(server, users[0].accessToken, workspace.id, projects[0].id, {
      title: 'Task 2',
      description: 'Second test task',
      priority: 'MEDIUM',
    }),
    createTestTask(server, users[0].accessToken, workspace.id, projects[1].id, {
      title: 'Task 3',
      description: 'Third test task',
      priority: 'LOW',
    }),
  ]);

  return { users, workspace, projects, tasks };
}
