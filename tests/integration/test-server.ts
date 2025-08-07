import { FastifyInstance } from 'fastify';
import { createServer } from '@/infrastructure/server/fastify-server';
import { mockServices } from '../mocks/services';
import { vi } from 'vitest';

export class TestServer {
  private server: FastifyInstance | null = null;

  async start(): Promise<FastifyInstance> {
    if (this.server) {
      return this.server;
    }

    // Create server instance
    this.server = await createServer();

    // Override services with mocks for testing
    this.setupMocks();

    return this.server;
  }

  async stop(): Promise<void> {
    if (this.server) {
      await this.server.close();
      this.server = null;
    }
  }

  async inject(options: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    payload?: any;
    query?: Record<string, string>;
  }) {
    if (!this.server) {
      throw new Error('Server not started. Call start() first.');
    }

    return this.server.inject(options);
  }

  private setupMocks(): void {
    // Mock database operations
    vi.doMock('@/infrastructure/database', () => ({
      prisma: mockServices.prisma,
    }));

    // Mock external services
    vi.doMock('@/infrastructure/email/email-service', () => ({
      EmailService: vi.fn().mockImplementation(() => mockServices.email),
    }));

    vi.doMock('@/infrastructure/sms/sms-service', () => ({
      SmsService: vi.fn().mockImplementation(() => mockServices.sms),
    }));

    vi.doMock('@/infrastructure/storage/file-service', () => ({
      FileService: vi.fn().mockImplementation(() => mockServices.file),
    }));

    vi.doMock('@/infrastructure/cache/redis-client', () => ({
      redisClient: mockServices.cache,
    }));

    vi.doMock('@/infrastructure/websocket/websocket-service', () => ({
      WebSocketService: vi
        .fn()
        .mockImplementation(() => mockServices.websocket),
    }));
  }

  // Helper methods for common test scenarios
  async authenticateUser(userId: string = 'test-user-id'): Promise<string> {
    // Mock JWT token for testing
    const token = `Bearer mock.jwt.token.${Buffer.from(
      JSON.stringify({
        userId,
        email: 'test@example.com',
        workspaceId: 'test-workspace-id',
        roles: ['member'],
        permissions: ['task:view', 'task:create', 'task:update'],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString('base64')}`;

    return token;
  }

  async createAuthenticatedRequest(options: {
    method: string;
    url: string;
    payload?: any;
    query?: Record<string, string>;
    userId?: string;
  }) {
    const token = await this.authenticateUser(options.userId);

    return this.inject({
      method: options.method,
      url: options.url,
      headers: {
        authorization: token,
        'content-type': 'application/json',
      },
      payload: options.payload,
      query: options.query,
    });
  }

  // Test data setup helpers
  setupUserMocks(users: any[] = []) {
    mockServices.prisma.user.findUnique.mockImplementation((args: any) => {
      const user = users.find(
        u => u.id === args.where.id || u.email === args.where.email
      );
      return Promise.resolve(user || null);
    });

    mockServices.prisma.user.findMany.mockResolvedValue(users);
    mockServices.prisma.user.count.mockResolvedValue(users.length);
  }

  setupWorkspaceMocks(workspaces: any[] = []) {
    mockServices.prisma.workspace.findUnique.mockImplementation((args: any) => {
      const workspace = workspaces.find(
        w => w.id === args.where.id || w.slug === args.where.slug
      );
      return Promise.resolve(workspace || null);
    });

    mockServices.prisma.workspace.findMany.mockResolvedValue(workspaces);
    mockServices.prisma.workspace.count.mockResolvedValue(workspaces.length);
  }

  setupProjectMocks(projects: any[] = []) {
    mockServices.prisma.project.findUnique.mockImplementation((args: any) => {
      const project = projects.find(p => p.id === args.where.id);
      return Promise.resolve(project || null);
    });

    mockServices.prisma.project.findMany.mockResolvedValue(projects);
    mockServices.prisma.project.count.mockResolvedValue(projects.length);
  }

  setupTaskMocks(tasks: any[] = []) {
    mockServices.prisma.task.findUnique.mockImplementation((args: any) => {
      const task = tasks.find(t => t.id === args.where.id);
      return Promise.resolve(task || null);
    });

    mockServices.prisma.task.findMany.mockResolvedValue(tasks);
    mockServices.prisma.task.count.mockResolvedValue(tasks.length);
  }

  // Reset all mocks
  resetMocks(): void {
    Object.values(mockServices).forEach(service => {
      if (typeof service === 'object' && service !== null) {
        Object.values(service).forEach(method => {
          if (vi.isMockFunction(method)) {
            method.mockReset();
          }
        });
      }
    });
  }
}

// Singleton instance for tests
let testServerInstance: TestServer | null = null;

export function getTestServer(): TestServer {
  if (!testServerInstance) {
    testServerInstance = new TestServer();
  }
  return testServerInstance;
}

export async function setupTestServer(): Promise<TestServer> {
  const server = getTestServer();
  await server.start();
  return server;
}

export async function teardownTestServer(): Promise<void> {
  if (testServerInstance) {
    await testServerInstance.stop();
    testServerInstance = null;
  }
}
