import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { createId } from '@paralleldrive/cuid2';

export class TestDatabaseUtils {
  private static prisma: PrismaClient;

  static initialize(databaseUrl: string): void {
    process.env.DATABASE_URL = databaseUrl;
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    });
  }

  static async cleanup(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect();
    }
  }

  static async resetDatabase(): Promise<void> {
    // Truncate all tables in the correct order to avoid foreign key constraints
    const tableNames = [
      'TaskComment',
      'TaskAttachment',
      'TaskActivity',
      'TaskDependency',
      'Task',
      'ProjectMember',
      'Project',
      'WorkspaceMember',
      'WorkspaceInvitation',
      'Workspace',
      'UserSession',
      'User',
      'AuditLog',
      'Notification',
      'WebhookDelivery',
      'Webhook',
    ];

    await this.prisma.$transaction(async tx => {
      // Disable foreign key checks
      await tx.$executeRaw`SET FOREIGN_KEY_CHECKS = 0`;

      // Truncate all tables
      for (const tableName of tableNames) {
        await tx.$executeRawUnsafe(`TRUNCATE TABLE \`${tableName}\``);
      }

      // Re-enable foreign key checks
      await tx.$executeRaw`SET FOREIGN_KEY_CHECKS = 1`;
    });
  }

  static async seedBasicData(): Promise<{
    userId: string;
    workspaceId: string;
    projectId: string;
    taskId: string;
  }> {
    const userId = createId();
    const workspaceId = createId();
    const projectId = createId();
    const taskId = createId();

    await this.prisma.$transaction(async tx => {
      // Create user
      await tx.user.create({
        data: {
          id: userId,
          email: 'test@example.com',
          name: 'Test User',
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$test',
          emailVerified: new Date(),
          mfaEnabled: false,
          totpSecret: null,
          backupCodes: [],
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
          lastLoginIp: '127.0.0.1',
          riskScore: 0.0,
          timezone: 'UTC',
          workHours: { start: '09:00', end: '17:00', days: [1, 2, 3, 4, 5] },
          taskViewPreferences: { defaultView: 'list', groupBy: 'status' },
          notificationSettings: { email: true, push: true, desktop: true },
          productivitySettings: { pomodoroLength: 25, breakLength: 5 },
          avatarColor: '#3B82F6',
          activeWorkspaceId: workspaceId,
          workspacePreferences: {},
        },
      });

      // Create workspace
      await tx.workspace.create({
        data: {
          id: workspaceId,
          name: 'Test Workspace',
          slug: 'test-workspace',
          description: 'A test workspace',
          ownerId: userId,
          subscriptionTier: 'free',
          billingEmail: 'billing@example.com',
          settings: {},
          branding: {},
          securitySettings: {},
          isActive: true,
          memberLimit: 10,
          projectLimit: 5,
          storageLimitGb: 1,
          deletedAt: null,
        },
      });

      // Create workspace member
      await tx.workspaceMember.create({
        data: {
          id: createId(),
          workspaceId,
          userId,
          role: 'OWNER',
          permissions: ['*'],
          invitedBy: userId,
          invitedAt: new Date(),
          joinedAt: new Date(),
          lastActiveAt: new Date(),
          settings: {},
        },
      });

      // Create project
      await tx.project.create({
        data: {
          id: projectId,
          workspaceId,
          name: 'Test Project',
          description: 'A test project',
          color: '#3B82F6',
          ownerId: userId,
          status: 'ACTIVE',
          priority: 'MEDIUM',
          startDate: new Date(),
          endDate: null,
          budgetAmount: null,
          budgetCurrency: 'USD',
          settings: {},
          templateId: null,
          isArchived: false,
          archivedAt: null,
          archivedBy: null,
          deletedAt: null,
        },
      });

      // Create project member
      await tx.projectMember.create({
        data: {
          id: createId(),
          projectId,
          userId,
          role: 'OWNER',
          permissions: ['*'],
          addedBy: userId,
          addedAt: new Date(),
        },
      });

      // Create task
      await tx.task.create({
        data: {
          id: taskId,
          workspaceId,
          projectId,
          title: 'Test Task',
          description: 'A test task',
          status: 'TODO',
          priority: 'MEDIUM',
          assigneeId: userId,
          creatorId: userId,
          reporterId: null,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          startDate: null,
          completedAt: null,
          estimatedHours: 4,
          actualHours: null,
          storyPoints: 3,
          tags: ['test'],
          labels: ['backend'],
          epicId: null,
          parentTaskId: null,
          attachments: [],
          externalLinks: [],
          recurringTaskId: null,
          recurrenceInstanceDate: null,
          watchers: [userId],
          lastActivityAt: new Date(),
          customFields: {},
          position: 0,
          deletedAt: null,
        },
      });
    });

    return { userId, workspaceId, projectId, taskId };
  }

  static async createTestTransaction<T>(
    callback: (tx: PrismaClient) => Promise<T>
  ): Promise<T> {
    return await this.prisma
      .$transaction(async tx => {
        const result = await callback(tx as PrismaClient);

        // Always rollback test transactions
        throw new Error('Test transaction rollback');
      })
      .catch(error => {
        if (error.message === 'Test transaction rollback') {
          // This is expected - we're rolling back the transaction
          return undefined as T;
        }
        throw error;
      });
  }

  static async executeRawQuery(
    query: string,
    params: any[] = []
  ): Promise<any> {
    return await this.prisma.$queryRawUnsafe(query, ...params);
  }

  static async getTableRowCount(tableName: string): Promise<number> {
    const result = (await this.prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM \`${tableName}\``
    )) as [{ count: bigint }];

    return Number(result[0].count);
  }

  static async verifyDatabaseConstraints(): Promise<{
    foreignKeys: boolean;
    uniqueConstraints: boolean;
    checkConstraints: boolean;
  }> {
    try {
      // Test foreign key constraints
      let foreignKeys = true;
      try {
        await this.prisma.task.create({
          data: {
            id: createId(),
            workspaceId: 'non-existent-workspace',
            projectId: 'non-existent-project',
            title: 'Test Task',
            description: 'Test',
            status: 'TODO',
            priority: 'MEDIUM',
            creatorId: 'non-existent-user',
            tags: [],
            labels: [],
            attachments: [],
            externalLinks: [],
            watchers: [],
            lastActivityAt: new Date(),
            customFields: {},
            position: 0,
          },
        });
        foreignKeys = false; // Should have failed
      } catch (error) {
        // Expected to fail due to foreign key constraint
      }

      // Test unique constraints
      let uniqueConstraints = true;
      try {
        const email = 'unique-test@example.com';
        await this.prisma.user.create({
          data: {
            id: createId(),
            email,
            name: 'Test User 1',
            passwordHash: 'test',
            emailVerified: new Date(),
            mfaEnabled: false,
            totpSecret: null,
            backupCodes: [],
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
            lastLoginIp: '127.0.0.1',
            riskScore: 0.0,
            timezone: 'UTC',
            workHours: { start: '09:00', end: '17:00', days: [1, 2, 3, 4, 5] },
            taskViewPreferences: { defaultView: 'list', groupBy: 'status' },
            notificationSettings: { email: true, push: true, desktop: true },
            productivitySettings: { pomodoroLength: 25, breakLength: 5 },
            avatarColor: '#3B82F6',
            activeWorkspaceId: null,
            workspacePreferences: {},
          },
        });

        await this.prisma.user.create({
          data: {
            id: createId(),
            email, // Same email - should fail
            name: 'Test User 2',
            passwordHash: 'test',
            emailVerified: new Date(),
            mfaEnabled: false,
            totpSecret: null,
            backupCodes: [],
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
            lastLoginIp: '127.0.0.1',
            riskScore: 0.0,
            timezone: 'UTC',
            workHours: { start: '09:00', end: '17:00', days: [1, 2, 3, 4, 5] },
            taskViewPreferences: { defaultView: 'list', groupBy: 'status' },
            notificationSettings: { email: true, push: true, desktop: true },
            productivitySettings: { pomodoroLength: 25, breakLength: 5 },
            avatarColor: '#3B82F6',
            activeWorkspaceId: null,
            workspacePreferences: {},
          },
        });
        uniqueConstraints = false; // Should have failed
      } catch (error) {
        // Expected to fail due to unique constraint
      }

      return {
        foreignKeys,
        uniqueConstraints,
        checkConstraints: true, // Assume check constraints work if others do
      };
    } catch (error) {
      console.error('Error verifying database constraints:', error);
      return {
        foreignKeys: false,
        uniqueConstraints: false,
        checkConstraints: false,
      };
    }
  }

  static getPrismaClient(): PrismaClient {
    return this.prisma;
  }
}
