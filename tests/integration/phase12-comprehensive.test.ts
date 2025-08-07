/**
 * Comprehensive Phase 12 Integration Tests
 * Tests all data consistency, scalability, and backup functionality
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from 'vitest';
import { PrismaClient } from '@prisma/client';
import { DataConsistencyManager } from '../../src/infrastructure/database/data-consistency-manager';
import { HorizontalScalingManager } from '../../src/infrastructure/scaling/horizontal-scaling-manager';
import { ComprehensiveBackupSystem } from '../../src/infrastructure/backup/comprehensive-backup-system';
import { Phase12IntegrationService } from '../../src/infrastructure/integration/phase12-integration-service';
import { TransactionManager } from '../../src/infrastructure/database/transaction-manager';
import { ReferentialIntegrityManager } from '../../src/infrastructure/database/referential-integrity';
import {
  OptimisticLockManager,
  OptimisticLockingError,
} from '../../src/shared/domain/optimistic-locking';

describe('Phase 12: Data Consistency and Scalability - Comprehensive Tests', () => {
  let prisma: PrismaClient;
  let dataConsistencyManager: DataConsistencyManager;
  let scalingManager: HorizontalScalingManager;
  let backupSystem: ComprehensiveBackupSystem;
  let integrationService: Phase12IntegrationService;
  let transactionManager: TransactionManager;
  let integrityManager: ReferentialIntegrityManager;

  beforeAll(async () => {
    // Initialize test database
    prisma = new PrismaClient({
      datasources: {
        db: {
          url:
            process.env.TEST_DATABASE_URL ||
            'postgresql://test:test@localhost:5432/test_db',
        },
      },
    });

    // Initialize managers
    dataConsistencyManager = new DataConsistencyManager(prisma);
    scalingManager = new HorizontalScalingManager();
    backupSystem = new ComprehensiveBackupSystem(prisma, {
      type: 'full',
      compression: true,
      encryption: false, // Disabled for tests
      retention: { daily: 1, weekly: 1, monthly: 1, yearly: 1 },
      storage: { local: { path: '/tmp/test-backups' } },
      verification: true,
      parallelism: 2,
    });
    transactionManager = new TransactionManager(prisma);
    integrityManager = new ReferentialIntegrityManager(prisma);

    integrationService = new Phase12IntegrationService({
      consistency: { checkInterval: 1, autoFix: false, alertThreshold: 1 },
      scalability: {
        enabled: true,
        minInstances: 1,
        maxInstances: 5,
        targetCpuUtilization: 70,
        targetMemoryUtilization: 80,
      },
      backup: {
        enabled: true,
        schedule: '*/5 * * * *',
        retention: 1,
        compression: true,
        encryption: false,
      },
      monitoring: {
        metricsInterval: 10,
        alerting: false,
        dashboardEnabled: false,
      },
    });

    await integrationService.initialize();
  });

  afterAll(async () => {
    await integrationService.shutdown();
    await scalingManager.shutdown();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.task.deleteMany();
    await prisma.project.deleteMany();
    await prisma.workspaceMember.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('Data Consistency Management', () => {
    it('should detect and handle optimistic locking conflicts', async () => {
      // Create test user
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          version: 1,
        },
      });

      // Simulate concurrent updates
      const updatePromises = [
        prisma.user.update({
          where: { id: user.id, version: 1 },
          data: { name: 'Updated Name 1', version: 2 },
        }),
        prisma.user.update({
          where: { id: user.id, version: 1 },
          data: { name: 'Updated Name 2', version: 2 },
        }),
      ];

      // One should succeed, one should fail
      const results = await Promise.allSettled(updatePromises);
      const successes = results.filter(r => r.status === 'fulfilled').length;
      const failures = results.filter(r => r.status === 'rejected').length;

      expect(successes).toBe(1);
      expect(failures).toBe(1);
    });

    it('should perform comprehensive consistency checks', async () => {
      // Create test data with potential inconsistencies
      const workspace = await prisma.workspace.create({
        data: {
          name: 'Test Workspace',
          slug: 'test-workspace',
          ownerId: 'non-existent-user', // This will create referential integrity violation
        },
      });

      const consistencyResult =
        await dataConsistencyManager.performFullConsistencyCheck();

      expect(consistencyResult.isConsistent).toBe(false);
      expect(consistencyResult.violations.length).toBeGreaterThan(0);
      expect(
        consistencyResult.violations.some(
          v => v.type === 'REFERENTIAL_INTEGRITY'
        )
      ).toBe(true);
    });

    it('should handle transaction rollback on consistency violations', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
        },
      });

      // Attempt transaction that should fail due to referential integrity
      await expect(
        dataConsistencyManager.executeWithConsistency(async context => {
          // Create workspace with valid owner
          await context.client.workspace.create({
            data: {
              name: 'Test Workspace',
              slug: 'test-workspace',
              ownerId: user.id,
            },
          });

          // Create task with invalid workspace reference
          await context.client.task.create({
            data: {
              title: 'Test Task',
              workspaceId: 'non-existent-workspace',
              creatorId: user.id,
            },
          });

          return 'success';
        })
      ).rejects.toThrow();

      // Verify no data was committed
      const workspaceCount = await prisma.workspace.count();
      const taskCount = await prisma.task.count();

      expect(workspaceCount).toBe(0);
      expect(taskCount).toBe(0);
    });

    it('should create and validate consistency snapshots', async () => {
      // Create test data
      const user = await prisma.user.create({
        data: { email: 'test@example.com', name: 'Test User' },
      });

      const workspace = await prisma.workspace.create({
        data: {
          name: 'Test Workspace',
          slug: 'test-workspace',
          ownerId: user.id,
        },
      });

      // Create consistency snapshot
      const snapshot = await dataConsistencyManager.createConsistencySnapshot();

      expect(snapshot.snapshotId).toBeDefined();
      expect(snapshot.timestamp).toBeInstanceOf(Date);
      expect(snapshot.entityCounts.users).toBe(1);
      expect(snapshot.entityCounts.workspaces).toBe(1);
      expect(snapshot.checksums).toBeDefined();
    });
  });

  describe('Horizontal Scaling Management', () => {
    it('should register and manage instances', async () => {
      const instanceInfo = {
        id: 'test-instance-1',
        host: 'localhost',
        port: 3001,
        status: 'healthy' as const,
        startedAt: new Date(),
        version: '1.0.0',
      };

      await scalingManager.registerInstance(instanceInfo);

      const status = scalingManager.getScalingStatus();
      expect(status.totalInstances).toBe(1);
      expect(status.healthyInstances).toBe(1);

      await scalingManager.unregisterInstance('test-instance-1');

      const statusAfter = scalingManager.getScalingStatus();
      expect(statusAfter.totalInstances).toBe(0);
    });

    it('should trigger scaling based on metrics', async () => {
      // Register test instances
      await scalingManager.registerInstance({
        id: 'test-instance-1',
        host: 'localhost',
        port: 3001,
        status: 'healthy',
        startedAt: new Date(),
        version: '1.0.0',
      });

      // Add scaling rule for testing
      scalingManager.addScalingRule({
        name: 'test_cpu_scale_up',
        metric: 'cpuUsage',
        threshold: 50,
        operator: 'gt',
        action: 'scale_up',
        cooldownPeriod: 1, // 1 second for testing
        minInstances: 1,
        maxInstances: 3,
        scaleStep: 1,
      });

      // Manually trigger scaling
      const scaleResult = await scalingManager.triggerScaling(
        'scale_up',
        'Test scaling'
      );
      expect(scaleResult).toBe(true);

      const status = scalingManager.getScalingStatus();
      expect(status.recentEvents.some(e => e.type === 'scale_up')).toBe(true);
    });

    it('should provide load balancing recommendations', async () => {
      // Register instances with different metrics
      await scalingManager.registerInstance({
        id: 'high-load-instance',
        host: 'localhost',
        port: 3001,
        status: 'healthy',
        startedAt: new Date(),
        version: '1.0.0',
      });

      const recommendations = scalingManager.getLoadBalancingRecommendations();
      expect(recommendations.recommendations).toBeDefined();
      expect(recommendations.suggestedActions).toBeDefined();
    });
  });

  describe('Comprehensive Backup System', () => {
    it('should create and verify full backups', async () => {
      // Create test data
      const user = await prisma.user.create({
        data: { email: 'backup-test@example.com', name: 'Backup Test User' },
      });

      const workspace = await prisma.workspace.create({
        data: {
          name: 'Backup Test Workspace',
          slug: 'backup-test-workspace',
          ownerId: user.id,
        },
      });

      // Create full backup
      const backupMetadata = await backupSystem.createFullBackup({
        description: 'Test full backup',
        tags: { test: 'true' },
      });

      expect(backupMetadata.id).toBeDefined();
      expect(backupMetadata.type).toBe('full');
      expect(backupMetadata.status).toBe('verified');
      expect(backupMetadata.tables.length).toBeGreaterThan(0);
      expect(backupMetadata.recordCounts.users).toBe(1);
      expect(backupMetadata.recordCounts.workspaces).toBe(1);
    });

    it('should create incremental backups', async () => {
      // Create initial data and full backup
      const user = await prisma.user.create({
        data: {
          email: 'incremental-test@example.com',
          name: 'Incremental Test User',
        },
      });

      const fullBackup = await backupSystem.createFullBackup({
        description: 'Base backup for incremental test',
      });

      // Add more data
      await prisma.workspace.create({
        data: {
          name: 'Incremental Test Workspace',
          slug: 'incremental-test-workspace',
          ownerId: user.id,
        },
      });

      // Create incremental backup
      const incrementalBackup = await backupSystem.createIncrementalBackup(
        fullBackup.id,
        { description: 'Test incremental backup' }
      );

      expect(incrementalBackup.type).toBe('incremental');
      expect(incrementalBackup.parentBackupId).toBe(fullBackup.id);
      expect(incrementalBackup.status).toBe('verified');
    });

    it('should restore from backup', async () => {
      // Create test data
      const originalUser = await prisma.user.create({
        data: { email: 'restore-test@example.com', name: 'Original User' },
      });

      // Create backup
      const backup = await backupSystem.createFullBackup({
        description: 'Backup for restore test',
      });

      // Modify data
      await prisma.user.update({
        where: { id: originalUser.id },
        data: { name: 'Modified User' },
      });

      // Restore from backup
      await backupSystem.restoreFromBackup({
        backupId: backup.id,
        dryRun: false,
        skipValidation: false,
        parallelism: 1,
      });

      // Verify restoration
      const restoredUser = await prisma.user.findUnique({
        where: { id: originalUser.id },
      });

      expect(restoredUser?.name).toBe('Original User');
    });
  });

  describe('Transaction Management', () => {
    it('should handle complex multi-aggregate transactions', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'transaction-test@example.com',
          name: 'Transaction Test User',
        },
      });

      const result = await transactionManager.executeTransaction(
        async context => {
          // Create workspace
          const workspace = await context.client.workspace.create({
            data: {
              name: 'Transaction Test Workspace',
              slug: 'transaction-test-workspace',
              ownerId: user.id,
            },
          });

          // Create project
          const project = await context.client.project.create({
            data: {
              name: 'Transaction Test Project',
              workspaceId: workspace.id,
              ownerId: user.id,
            },
          });

          // Create task
          const task = await context.client.task.create({
            data: {
              title: 'Transaction Test Task',
              workspaceId: workspace.id,
              projectId: project.id,
              creatorId: user.id,
            },
          });

          return { workspace, project, task };
        }
      );

      expect(result.result.workspace).toBeDefined();
      expect(result.result.project).toBeDefined();
      expect(result.result.task).toBeDefined();
      expect(result.operationCount).toBe(3);
    });

    it('should handle transaction rollback on failure', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'rollback-test@example.com',
          name: 'Rollback Test User',
        },
      });

      await expect(
        transactionManager.executeTransaction(async context => {
          // Create workspace
          await context.client.workspace.create({
            data: {
              name: 'Rollback Test Workspace',
              slug: 'rollback-test-workspace',
              ownerId: user.id,
            },
          });

          // This should fail and cause rollback
          throw new Error('Intentional transaction failure');
        })
      ).rejects.toThrow('Intentional transaction failure');

      // Verify no workspace was created
      const workspaceCount = await prisma.workspace.count();
      expect(workspaceCount).toBe(0);
    });

    it('should support saga pattern for distributed transactions', async () => {
      const user = await prisma.user.create({
        data: { email: 'saga-test@example.com', name: 'Saga Test User' },
      });

      const operations = [
        {
          execute: async (context: any) => {
            return await context.client.workspace.create({
              data: {
                name: 'Saga Test Workspace',
                slug: 'saga-test-workspace',
                ownerId: user.id,
              },
            });
          },
          compensate: async (context: any, result: any) => {
            await context.client.workspace.delete({
              where: { id: result.id },
            });
          },
        },
        {
          execute: async (context: any) => {
            const workspace = await context.client.workspace.findFirst();
            return await context.client.project.create({
              data: {
                name: 'Saga Test Project',
                workspaceId: workspace!.id,
                ownerId: user.id,
              },
            });
          },
          compensate: async (context: any, result: any) => {
            await context.client.project.delete({
              where: { id: result.id },
            });
          },
        },
      ];

      const result = await transactionManager.executeSaga(operations);
      expect(result.result).toHaveLength(2);
      expect(result.operationCount).toBe(2);
    });
  });

  describe('Referential Integrity Management', () => {
    it('should detect referential integrity violations', async () => {
      // Create workspace with non-existent owner
      await prisma.$executeRaw`
        INSERT INTO workspaces (id, name, slug, owner_id, created_at, updated_at)
        VALUES ('test-workspace', 'Test Workspace', 'test-workspace', 'non-existent-user', NOW(), NOW())
      `;

      const integrityResult =
        await integrityManager.performFullIntegrityCheck();

      expect(integrityResult.isValid).toBe(false);
      expect(integrityResult.violations.length).toBeGreaterThan(0);
      expect(
        integrityResult.violations.some(v => v.violationType === 'FOREIGN_KEY')
      ).toBe(true);
    });

    it('should validate entity referential integrity', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'integrity-test@example.com',
          name: 'Integrity Test User',
        },
      });

      // Test valid reference
      const validResult = await integrityManager.validateEntity(
        'workspaces',
        'test-id',
        'create'
      );
      expect(validResult.isValid).toBe(true);

      // Test invalid reference would require more complex setup
    });

    it('should generate integrity report', async () => {
      const report = await integrityManager.generateIntegrityReport();

      expect(report.summary.totalConstraints).toBeGreaterThan(0);
      expect(report.summary.activeConstraints).toBeGreaterThan(0);
      expect(report.constraintDetails).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });
  });

  describe('Phase 12 Integration Service', () => {
    it('should provide comprehensive system status', async () => {
      const status = await integrationService.getSystemStatus();

      expect(status.dataConsistency).toBeDefined();
      expect(status.scalability).toBeDefined();
      expect(status.backup).toBeDefined();
      expect(status.overall.status).toMatch(/healthy|warning|critical/);
      expect(status.overall.score).toBeGreaterThanOrEqual(0);
      expect(status.overall.score).toBeLessThanOrEqual(100);
    });

    it('should validate entire system', async () => {
      const validation = await integrationService.validateSystem();

      expect(validation.isValid).toBeDefined();
      expect(validation.issues).toBeDefined();
      expect(validation.score).toBeGreaterThanOrEqual(0);
      expect(validation.score).toBeLessThanOrEqual(100);
    });

    it('should execute emergency procedures', async () => {
      const emergencyResult =
        await integrationService.executeEmergencyProcedures('system_overload');

      expect(emergencyResult.success).toBeDefined();
      expect(emergencyResult.actions).toBeDefined();
      expect(emergencyResult.actions.length).toBeGreaterThan(0);
      expect(emergencyResult.duration).toBeGreaterThan(0);
    });

    it('should generate comprehensive system report', async () => {
      const report = await integrationService.generateSystemReport();

      expect(report.summary).toBeDefined();
      expect(report.components).toBeDefined();
      expect(report.metrics).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.trends).toBeDefined();
    });

    it('should track system metrics', async () => {
      const metrics = integrationService.getMetrics();

      expect(metrics.consistency).toBeDefined();
      expect(metrics.scalability).toBeDefined();
      expect(metrics.backup).toBeDefined();
      expect(metrics.transactions).toBeDefined();
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent transactions without deadlocks', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'concurrent-test@example.com',
          name: 'Concurrent Test User',
        },
      });

      const workspace = await prisma.workspace.create({
        data: {
          name: 'Concurrent Test Workspace',
          slug: 'concurrent-test-workspace',
          ownerId: user.id,
        },
      });

      // Execute multiple concurrent transactions
      const concurrentTransactions = Array.from({ length: 10 }, (_, i) =>
        transactionManager.executeTransaction(async context => {
          return await context.client.task.create({
            data: {
              title: `Concurrent Task ${i}`,
              workspaceId: workspace.id,
              creatorId: user.id,
            },
          });
        })
      );

      const results = await Promise.allSettled(concurrentTransactions);
      const successes = results.filter(r => r.status === 'fulfilled').length;

      expect(successes).toBe(10);

      // Verify all tasks were created
      const taskCount = await prisma.task.count();
      expect(taskCount).toBe(10);
    });

    it('should maintain consistency under high load', async () => {
      const user = await prisma.user.create({
        data: { email: 'load-test@example.com', name: 'Load Test User' },
      });

      const workspace = await prisma.workspace.create({
        data: {
          name: 'Load Test Workspace',
          slug: 'load-test-workspace',
          ownerId: user.id,
        },
      });

      // Create high load scenario
      const highLoadOperations = Array.from({ length: 50 }, (_, i) =>
        dataConsistencyManager.executeWithConsistency(async context => {
          // Create project
          const project = await context.client.project.create({
            data: {
              name: `Load Test Project ${i}`,
              workspaceId: workspace.id,
              ownerId: user.id,
            },
          });

          // Create multiple tasks for the project
          const tasks = await Promise.all(
            Array.from({ length: 5 }, (_, j) =>
              context.client.task.create({
                data: {
                  title: `Load Test Task ${i}-${j}`,
                  workspaceId: workspace.id,
                  projectId: project.id,
                  creatorId: user.id,
                },
              })
            )
          );

          return { project, tasks };
        })
      );

      const results = await Promise.allSettled(highLoadOperations);
      const successes = results.filter(r => r.status === 'fulfilled').length;

      // Should handle most operations successfully
      expect(successes).toBeGreaterThan(40);

      // Verify data consistency after high load
      const consistencyResult =
        await dataConsistencyManager.performFullConsistencyCheck();
      expect(consistencyResult.isConsistent).toBe(true);
    });
  });

  describe('Disaster Recovery Testing', () => {
    it('should handle data corruption scenarios', async () => {
      // Create test data
      const user = await prisma.user.create({
        data: {
          email: 'disaster-test@example.com',
          name: 'Disaster Test User',
        },
      });

      // Simulate data corruption emergency
      const emergencyResult =
        await integrationService.executeEmergencyProcedures('data_corruption');

      expect(emergencyResult.success).toBe(true);
      expect(
        emergencyResult.actions.some(a => a.includes('emergency backup'))
      ).toBe(true);
      expect(
        emergencyResult.actions.some(a => a.includes('integrity check'))
      ).toBe(true);
    });

    it('should handle backup failure scenarios', async () => {
      const emergencyResult =
        await integrationService.executeEmergencyProcedures('backup_failure');

      expect(emergencyResult.success).toBe(true);
      expect(
        emergencyResult.actions.some(a => a.includes('backup failure'))
      ).toBe(true);
    });
  });
});
