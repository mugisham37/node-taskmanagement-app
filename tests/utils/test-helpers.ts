import { vi } from 'vitest';
import { User, Workspace, Project, Task } from '@prisma/client';
import argon2 from 'argon2';

// Test data factories
export class TestDataFactory {
  static async createTestUser(overrides: Partial<User> = {}): Promise<User> {
    const defaultUser: Omit<User, 'id' | 'createdAt' | 'updatedAt'> = {
      email: `test-${Date.now()}@example.com`,
      emailVerified: new Date(),
      name: 'Test User',
      image: null,
      passwordHash: await argon2.hash('test123'),
      mfaEnabled: false,
      totpSecret: null,
      backupCodes: [],
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
      lastLoginIp: null,
      riskScore: 0.0,
      timezone: 'UTC',
      workHours: { start: '09:00', end: '17:00', days: [1, 2, 3, 4, 5] },
      taskViewPreferences: { defaultView: 'list', groupBy: 'status' },
      notificationSettings: { email: true, push: true, desktop: true },
      productivitySettings: { pomodoroLength: 25, breakLength: 5 },
      avatarColor: '#3B82F6',
      activeWorkspaceId: null,
      workspacePreferences: {},
    };

    return {
      ...defaultUser,
      ...overrides,
      id: `test-user-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as User;
  }

  static createTestWorkspace(overrides: Partial<Workspace> = {}): Workspace {
    const defaultWorkspace: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'> =
      {
        name: 'Test Workspace',
        slug: `test-workspace-${Date.now()}`,
        description: 'A test workspace',
        ownerId: 'test-owner-id',
        subscriptionTier: 'free',
        billingEmail: null,
        settings: {},
        branding: {},
        securitySettings: {},
        isActive: true,
        memberLimit: 10,
        projectLimit: 5,
        storageLimitGb: 1,
        deletedAt: null,
      };

    return {
      ...defaultWorkspace,
      ...overrides,
      id: `test-workspace-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Workspace;
  }

  static createTestProject(overrides: Partial<Project> = {}): Project {
    const defaultProject: Omit<Project, 'id' | 'createdAt' | 'updatedAt'> = {
      workspaceId: 'test-workspace-id',
      name: 'Test Project',
      description: 'A test project',
      color: '#3B82F6',
      ownerId: 'test-owner-id',
      status: 'ACTIVE',
      priority: 'MEDIUM',
      startDate: null,
      endDate: null,
      budgetAmount: null,
      budgetCurrency: 'USD',
      settings: {},
      templateId: null,
      isArchived: false,
      archivedAt: null,
      archivedBy: null,
      deletedAt: null,
    };

    return {
      ...defaultProject,
      ...overrides,
      id: `test-project-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Project;
  }

  static createTestTask(overrides: Partial<Task> = {}): Task {
    const defaultTask: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> = {
      workspaceId: 'test-workspace-id',
      projectId: 'test-project-id',
      title: 'Test Task',
      description: 'A test task',
      status: 'TODO',
      priority: 'MEDIUM',
      assigneeId: null,
      creatorId: 'test-creator-id',
      reporterId: null,
      dueDate: null,
      startDate: null,
      completedAt: null,
      estimatedHours: null,
      actualHours: null,
      storyPoints: null,
      tags: [],
      labels: [],
      epicId: null,
      parentTaskId: null,
      attachments: [],
      externalLinks: [],
      recurringTaskId: null,
      recurrenceInstanceDate: null,
      watchers: [],
      lastActivityAt: new Date(),
      customFields: {},
      position: 0,
      deletedAt: null,
    };

    return {
      ...defaultTask,
      ...overrides,
      id: `test-task-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Task;
  }
}

// Mock service factory
export class MockServiceFactory {
  static createMockPrismaClient() {
    return {
      user: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      workspace: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      project: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      task: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      $transaction: vi.fn(),
      $queryRaw: vi.fn(),
      $executeRaw: vi.fn(),
      $disconnect: vi.fn(),
    };
  }

  static createMockAuthService() {
    return {
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
    };
  }

  static createMockTaskService() {
    return {
      createTask: vi.fn(),
      updateTask: vi.fn(),
      deleteTask: vi.fn(),
      getTask: vi.fn(),
      getTasks: vi.fn(),
      assignTask: vi.fn(),
      completeTask: vi.fn(),
      addComment: vi.fn(),
      addAttachment: vi.fn(),
    };
  }

  static createMockWorkspaceService() {
    return {
      createWorkspace: vi.fn(),
      updateWorkspace: vi.fn(),
      deleteWorkspace: vi.fn(),
      getWorkspace: vi.fn(),
      getUserWorkspaces: vi.fn(),
      addMember: vi.fn(),
      removeMember: vi.fn(),
      updateMemberRole: vi.fn(),
    };
  }

  static createMockNotificationService() {
    return {
      sendNotification: vi.fn(),
      sendBulkNotifications: vi.fn(),
      markAsRead: vi.fn(),
      getUserNotifications: vi.fn(),
      updatePreferences: vi.fn(),
    };
  }
}

// Test database utilities
export class TestDatabaseUtils {
  static async cleanupTestData(): Promise<void> {
    // This would clean up test data from the database
    // For now, we'll just log that cleanup would happen
    console.log('Test data cleanup would be performed');
  }

  static async seedTestData(): Promise<{
    users: User[];
    workspaces: Workspace[];
    projects: Project[];
    tasks: Task[];
  }> {
    // This would seed test data into the database
    // For now, we'll return mock data
    const users = [await TestDataFactory.createTestUser()];
    const workspaces = [
      TestDataFactory.createTestWorkspace({ ownerId: users[0].id }),
    ];
    const projects = [
      TestDataFactory.createTestProject({
        workspaceId: workspaces[0].id,
        ownerId: users[0].id,
      }),
    ];
    const tasks = [
      TestDataFactory.createTestTask({
        workspaceId: workspaces[0].id,
        projectId: projects[0].id,
        creatorId: users[0].id,
      }),
    ];

    return { users, workspaces, projects, tasks };
  }

  static async createTestTransaction<T>(
    callback: () => Promise<T>
  ): Promise<T> {
    // This would wrap the callback in a database transaction that gets rolled back
    // For now, we'll just execute the callback
    return await callback();
  }
}

// WebSocket testing utilities
export class WebSocketTestUtils {
  static createMockWebSocketConnection() {
    return {
      id: `ws-${Date.now()}`,
      userId: 'test-user-id',
      workspaceId: 'test-workspace-id',
      send: vi.fn(),
      close: vi.fn(),
      isAlive: true,
      lastPing: new Date(),
    };
  }

  static createMockWebSocketServer() {
    return {
      clients: new Set(),
      broadcast: vi.fn(),
      sendToUser: vi.fn(),
      sendToWorkspace: vi.fn(),
      addConnection: vi.fn(),
      removeConnection: vi.fn(),
    };
  }
}

// Authentication testing utilities
export class AuthTestUtils {
  static createMockJwtToken(payload: Record<string, any> = {}): string {
    const defaultPayload = {
      userId: 'test-user-id',
      email: 'test@example.com',
      workspaceId: 'test-workspace-id',
      roles: ['member'],
      permissions: ['task:view', 'task:create'],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    };

    // In a real implementation, this would be a properly signed JWT
    // For testing, we'll return a mock token
    return `mock.jwt.token.${Buffer.from(JSON.stringify({ ...defaultPayload, ...payload })).toString('base64')}`;
  }

  static createMockAuthContext(overrides: Record<string, any> = {}) {
    return {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        workspaceId: 'test-workspace-id',
        roles: ['member'],
        permissions: ['task:view', 'task:create'],
        ...overrides.user,
      },
      token: AuthTestUtils.createMockJwtToken(overrides.token),
      isAuthenticated: true,
      ...overrides,
    };
  }
}

// API testing utilities
export class ApiTestUtils {
  static createMockRequest(overrides: Record<string, any> = {}) {
    return {
      method: 'GET',
      url: '/api/test',
      headers: {},
      query: {},
      params: {},
      body: {},
      user: null,
      ...overrides,
    };
  }

  static createMockResponse() {
    return {
      statusCode: 200,
      headers: {},
      send: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis(),
      cookie: vi.fn().mockReturnThis(),
      redirect: vi.fn().mockReturnThis(),
    };
  }

  static createMockFastifyInstance() {
    return {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      register: vi.fn(),
      listen: vi.fn(),
      close: vi.fn(),
      inject: vi.fn(),
      addHook: vi.fn(),
      setErrorHandler: vi.fn(),
    };
  }
}
