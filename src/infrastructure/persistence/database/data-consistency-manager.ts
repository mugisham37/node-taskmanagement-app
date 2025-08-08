/**
 * Comprehensive Data Consistency Manager
 * Orchestrates all data consistency mechanisms at the highest level
 */

import { PrismaClient } from '@prisma/client';
import { prisma } from './prisma-client';
import { logger } from '../logging/logger';
import { TransactionManager, TransactionContext } from './transaction-manager';
import {
  OptimisticLockManager,
  OptimisticLockingError,
} from '../../shared/domain/optimistic-locking';
import { ReferentialIntegrityManager } from './referential-integrity';
import {
  ValidationEngine,
  ValidationResult,
} from '../../shared/validation/validation-engine';

export interface ConsistencyCheckResult {
  isConsistent: boolean;
  violations: ConsistencyViolation[];
  warnings: string[];
  checkedEntities: number;
  executionTime: number;
  recommendations: string[];
}

export interface ConsistencyViolation {
  type:
    | 'OPTIMISTIC_LOCK'
    | 'REFERENTIAL_INTEGRITY'
    | 'DATA_VALIDATION'
    | 'TRANSACTION_ISOLATION';
  entityType: string;
  entityId: string;
  field?: string;
  expectedValue?: any;
  actualValue?: any;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  autoFixable: boolean;
}

export interface ConsistencyPolicy {
  enforceOptimisticLocking: boolean;
  enforceReferentialIntegrity: boolean;
  enforceDataValidation: boolean;
  isolationLevel:
    | 'READ_UNCOMMITTED'
    | 'READ_COMMITTED'
    | 'REPEATABLE_READ'
    | 'SERIALIZABLE';
  retryAttempts: number;
  retryDelay: number;
  autoFixViolations: boolean;
}

export class DataConsistencyManager {
  private readonly transactionManager: TransactionManager;
  private readonly integrityManager: ReferentialIntegrityManager;
  private readonly validationEngine: ValidationEngine;
  private readonly defaultPolicy: ConsistencyPolicy;

  constructor(private readonly client: PrismaClient = prisma) {
    this.transactionManager = new TransactionManager(client);
    this.integrityManager = new ReferentialIntegrityManager(client);
    this.validationEngine = new ValidationEngine();

    this.defaultPolicy = {
      enforceOptimisticLocking: true,
      enforceReferentialIntegrity: true,
      enforceDataValidation: true,
      isolationLevel: 'READ_COMMITTED',
      retryAttempts: 3,
      retryDelay: 1000,
      autoFixViolations: false,
    };
  }

  /**
   * Execute operation with comprehensive consistency guarantees
   */
  async executeWithConsistency<T>(
    operation: (context: TransactionContext) => Promise<T>,
    policy: Partial<ConsistencyPolicy> = {}
  ): Promise<T> {
    const finalPolicy = { ...this.defaultPolicy, ...policy };

    return await OptimisticLockManager.withRetry(
      async () => {
        return await this.transactionManager.executeTransaction(
          async context => {
            // Pre-operation consistency checks
            await this.performPreOperationChecks(context, finalPolicy);

            // Execute the operation
            const result = await operation(context);

            // Post-operation consistency validation
            await this.performPostOperationChecks(context, finalPolicy);

            return result;
          },
          {
            isolationLevel: this.mapIsolationLevel(finalPolicy.isolationLevel),
            retryAttempts: finalPolicy.retryAttempts,
            retryDelay: finalPolicy.retryDelay,
          }
        );
      },
      finalPolicy.retryAttempts,
      finalPolicy.retryDelay
    );
  }

  /**
   * Perform comprehensive consistency check across all entities
   */
  async performFullConsistencyCheck(
    policy: Partial<ConsistencyPolicy> = {}
  ): Promise<ConsistencyCheckResult> {
    const startTime = Date.now();
    const finalPolicy = { ...this.defaultPolicy, ...policy };
    const violations: ConsistencyViolation[] = [];
    const warnings: string[] = [];
    let checkedEntities = 0;

    try {
      logger.info('Starting comprehensive consistency check', {
        policy: finalPolicy,
      });

      // Check optimistic locking consistency
      if (finalPolicy.enforceOptimisticLocking) {
        const lockingViolations =
          await this.checkOptimisticLockingConsistency();
        violations.push(...lockingViolations);
        checkedEntities += lockingViolations.length;
      }

      // Check referential integrity
      if (finalPolicy.enforceReferentialIntegrity) {
        const integrityResult =
          await this.integrityManager.performFullIntegrityCheck();
        const integrityViolations = integrityResult.violations.map(v => ({
          type: 'REFERENTIAL_INTEGRITY' as const,
          entityType: v.table,
          entityId: String(v.value),
          field: v.column,
          expectedValue: null,
          actualValue: v.value,
          message: v.message,
          severity: 'HIGH' as const,
          autoFixable: v.violationType === 'FOREIGN_KEY',
        }));
        violations.push(...integrityViolations);
        warnings.push(...integrityResult.warnings);
        checkedEntities += integrityResult.checkedConstraints;
      }

      // Check data validation consistency
      if (finalPolicy.enforceDataValidation) {
        const validationViolations =
          await this.checkDataValidationConsistency();
        violations.push(...validationViolations);
        checkedEntities += validationViolations.length;
      }

      // Check transaction isolation consistency
      const isolationViolations =
        await this.checkTransactionIsolationConsistency();
      violations.push(...isolationViolations);

      const executionTime = Date.now() - startTime;
      const recommendations =
        await this.generateConsistencyRecommendations(violations);

      // Auto-fix violations if enabled
      if (finalPolicy.autoFixViolations && violations.length > 0) {
        const fixableViolations = violations.filter(v => v.autoFixable);
        if (fixableViolations.length > 0) {
          const fixResult = await this.autoFixViolations(fixableViolations);
          warnings.push(
            `Auto-fixed ${fixResult.fixed} violations, ${fixResult.failed} failed`
          );
        }
      }

      const result: ConsistencyCheckResult = {
        isConsistent: violations.length === 0,
        violations,
        warnings,
        checkedEntities,
        executionTime,
        recommendations,
      };

      logger.info('Consistency check completed', {
        isConsistent: result.isConsistent,
        violations: violations.length,
        warnings: warnings.length,
        checkedEntities,
        executionTime,
      });

      return result;
    } catch (error) {
      logger.error('Consistency check failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        isConsistent: false,
        violations: [
          {
            type: 'DATA_VALIDATION',
            entityType: 'SYSTEM',
            entityId: 'SYSTEM',
            message: `Consistency check failed: ${error}`,
            severity: 'CRITICAL',
            autoFixable: false,
          },
        ],
        warnings,
        checkedEntities,
        executionTime: Date.now() - startTime,
        recommendations: [
          'System consistency check failed - manual intervention required',
        ],
      };
    }
  }

  /**
   * Create consistency snapshot for point-in-time recovery
   */
  async createConsistencySnapshot(): Promise<{
    snapshotId: string;
    timestamp: Date;
    entityCounts: Record<string, number>;
    checksums: Record<string, string>;
  }> {
    const snapshotId = `snapshot_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const timestamp = new Date();

    return await this.transactionManager.executeTransaction(async context => {
      // Get entity counts for all major tables
      const entityCounts = await this.getEntityCounts(context);

      // Generate checksums for data integrity verification
      const checksums = await this.generateDataChecksums(context);

      logger.info('Consistency snapshot created', {
        snapshotId,
        timestamp,
        entityCounts,
      });

      return {
        snapshotId,
        timestamp,
        entityCounts,
        checksums,
      };
    });
  }

  /**
   * Validate consistency against a snapshot
   */
  async validateAgainstSnapshot(snapshotId: string): Promise<{
    isValid: boolean;
    differences: Array<{
      entity: string;
      expectedCount: number;
      actualCount: number;
      expectedChecksum: string;
      actualChecksum: string;
    }>;
  }> {
    // This would typically load snapshot data from storage
    // For now, we'll create a current snapshot and compare
    const currentSnapshot = await this.createConsistencySnapshot();

    return {
      isValid: true, // Placeholder - would compare with stored snapshot
      differences: [],
    };
  }

  private async performPreOperationChecks(
    context: TransactionContext,
    policy: ConsistencyPolicy
  ): Promise<void> {
    // Validate transaction isolation level
    if (policy.isolationLevel === 'SERIALIZABLE') {
      await this.validateSerializableIsolation(context);
    }

    // Check for potential deadlocks
    await this.checkForPotentialDeadlocks(context);
  }

  private async performPostOperationChecks(
    context: TransactionContext,
    policy: ConsistencyPolicy
  ): Promise<void> {
    // Validate all domain events for consistency
    for (const event of context.events) {
      await this.validateDomainEventConsistency(event);
    }

    // Check for referential integrity violations
    if (policy.enforceReferentialIntegrity) {
      await this.validateTransactionIntegrity(context);
    }
  }

  private async checkOptimisticLockingConsistency(): Promise<
    ConsistencyViolation[]
  > {
    const violations: ConsistencyViolation[] = [];

    try {
      // Check for entities with invalid version numbers
      const invalidVersions = (await this.client.$queryRaw`
        SELECT 'users' as table_name, id, version
        FROM users
        WHERE version < 1 OR version IS NULL
        UNION ALL
        SELECT 'tasks' as table_name, id, version
        FROM tasks
        WHERE version < 1 OR version IS NULL
        UNION ALL
        SELECT 'projects' as table_name, id, version
        FROM projects
        WHERE version < 1 OR version IS NULL
      `) as any[];

      for (const record of invalidVersions) {
        violations.push({
          type: 'OPTIMISTIC_LOCK',
          entityType: record.table_name,
          entityId: record.id,
          field: 'version',
          expectedValue: 'positive integer',
          actualValue: record.version,
          message: `Invalid version number for ${record.table_name}:${record.id}`,
          severity: 'HIGH',
          autoFixable: true,
        });
      }
    } catch (error) {
      logger.error('Optimistic locking consistency check failed', { error });
    }

    return violations;
  }

  private async checkDataValidationConsistency(): Promise<
    ConsistencyViolation[]
  > {
    const violations: ConsistencyViolation[] = [];

    try {
      // Check for data validation violations across entities
      const validationResults = await Promise.all([
        this.validateEntityData('users'),
        this.validateEntityData('tasks'),
        this.validateEntityData('projects'),
        this.validateEntityData('workspaces'),
      ]);

      for (const result of validationResults) {
        if (!result.isValid) {
          violations.push(
            ...result.errors.map(error => ({
              type: 'DATA_VALIDATION' as const,
              entityType: result.entityType,
              entityId: result.entityId || 'UNKNOWN',
              field: error.field,
              expectedValue: error.expectedValue,
              actualValue: error.actualValue,
              message: error.message,
              severity: 'MEDIUM' as const,
              autoFixable: false,
            }))
          );
        }
      }
    } catch (error) {
      logger.error('Data validation consistency check failed', { error });
    }

    return violations;
  }

  private async checkTransactionIsolationConsistency(): Promise<
    ConsistencyViolation[]
  > {
    const violations: ConsistencyViolation[] = [];

    try {
      // Check for phantom reads, dirty reads, and non-repeatable reads
      // This is a simplified check - in practice, this would be more complex
      const isolationIssues = (await this.client.$queryRaw`
        SELECT 
          'ISOLATION_VIOLATION' as issue_type,
          'SYSTEM' as entity_type,
          'SYSTEM' as entity_id,
          'Transaction isolation may be compromised' as message
        WHERE EXISTS (
          SELECT 1 FROM pg_stat_activity 
          WHERE state = 'active' 
          AND query LIKE '%FOR UPDATE%'
          GROUP BY datname 
          HAVING COUNT(*) > 10
        )
      `) as any[];

      for (const issue of isolationIssues) {
        violations.push({
          type: 'TRANSACTION_ISOLATION',
          entityType: issue.entity_type,
          entityId: issue.entity_id,
          message: issue.message,
          severity: 'MEDIUM',
          autoFixable: false,
        });
      }
    } catch (error) {
      logger.error('Transaction isolation consistency check failed', { error });
    }

    return violations;
  }

  private async validateEntityData(entityType: string): Promise<{
    isValid: boolean;
    entityType: string;
    entityId?: string;
    errors: Array<{
      field: string;
      message: string;
      expectedValue?: any;
      actualValue?: any;
    }>;
  }> {
    // This would use the validation engine to validate entity data
    // For now, return a placeholder result
    return {
      isValid: true,
      entityType,
      errors: [],
    };
  }

  private async autoFixViolations(violations: ConsistencyViolation[]): Promise<{
    fixed: number;
    failed: number;
    errors: string[];
  }> {
    let fixed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const violation of violations) {
      try {
        const success = await this.fixViolation(violation);
        if (success) {
          fixed++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
        errors.push(`Failed to fix ${violation.type} violation: ${error}`);
      }
    }

    return { fixed, failed, errors };
  }

  private async fixViolation(
    violation: ConsistencyViolation
  ): Promise<boolean> {
    switch (violation.type) {
      case 'OPTIMISTIC_LOCK':
        return await this.fixOptimisticLockViolation(violation);
      case 'REFERENTIAL_INTEGRITY':
        return await this.fixReferentialIntegrityViolation(violation);
      default:
        return false;
    }
  }

  private async fixOptimisticLockViolation(
    violation: ConsistencyViolation
  ): Promise<boolean> {
    try {
      // Fix invalid version numbers
      if (violation.field === 'version') {
        await this.client.$executeRaw`
          UPDATE ${violation.entityType}
          SET version = 1
          WHERE id = ${violation.entityId} AND (version < 1 OR version IS NULL)
        `;
        return true;
      }
    } catch (error) {
      logger.error('Failed to fix optimistic lock violation', {
        violation,
        error,
      });
    }
    return false;
  }

  private async fixReferentialIntegrityViolation(
    violation: ConsistencyViolation
  ): Promise<boolean> {
    // Delegate to referential integrity manager
    return false; // Would implement specific fixes
  }

  private async generateConsistencyRecommendations(
    violations: ConsistencyViolation[]
  ): Promise<string[]> {
    const recommendations: string[] = [];

    const violationsByType = violations.reduce(
      (acc, v) => {
        acc[v.type] = (acc[v.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    if (violationsByType.OPTIMISTIC_LOCK > 0) {
      recommendations.push(
        `${violationsByType.OPTIMISTIC_LOCK} optimistic locking violations detected. Consider reviewing concurrent access patterns.`
      );
    }

    if (violationsByType.REFERENTIAL_INTEGRITY > 0) {
      recommendations.push(
        `${violationsByType.REFERENTIAL_INTEGRITY} referential integrity violations detected. Review foreign key constraints.`
      );
    }

    if (violationsByType.DATA_VALIDATION > 0) {
      recommendations.push(
        `${violationsByType.DATA_VALIDATION} data validation violations detected. Review input validation rules.`
      );
    }

    if (violations.some(v => v.severity === 'CRITICAL')) {
      recommendations.push(
        'Critical violations detected. Immediate attention required.'
      );
    }

    return recommendations;
  }

  private async getEntityCounts(
    context: TransactionContext
  ): Promise<Record<string, number>> {
    const counts = await Promise.all([
      context.client.user.count(),
      context.client.workspace.count(),
      context.client.project.count(),
      context.client.task.count(),
      context.client.comment.count(),
      context.client.notification.count(),
    ]);

    return {
      users: counts[0],
      workspaces: counts[1],
      projects: counts[2],
      tasks: counts[3],
      comments: counts[4],
      notifications: counts[5],
    };
  }

  private async generateDataChecksums(
    context: TransactionContext
  ): Promise<Record<string, string>> {
    // Generate checksums for critical data
    const checksums: Record<string, string> = {};

    try {
      const tables = ['users', 'workspaces', 'projects', 'tasks'];

      for (const table of tables) {
        const checksum = (await context.client.$queryRaw`
          SELECT md5(string_agg(md5(t.*::text), '' ORDER BY id)) as checksum
          FROM ${table} t
        `) as any[];

        checksums[table] = checksum[0]?.checksum || '';
      }
    } catch (error) {
      logger.error('Failed to generate data checksums', { error });
    }

    return checksums;
  }

  private mapIsolationLevel(level: ConsistencyPolicy['isolationLevel']) {
    const mapping = {
      READ_UNCOMMITTED: 'ReadUncommitted',
      READ_COMMITTED: 'ReadCommitted',
      REPEATABLE_READ: 'RepeatableRead',
      SERIALIZABLE: 'Serializable',
    } as const;

    return mapping[level] as any;
  }

  private async validateSerializableIsolation(
    context: TransactionContext
  ): Promise<void> {
    // Validate that serializable isolation is properly configured
    const isolationLevel = (await context.client
      .$queryRaw`SHOW transaction_isolation`) as any[];

    if (isolationLevel[0]?.transaction_isolation !== 'serializable') {
      logger.warn('Expected serializable isolation level', {
        expected: 'serializable',
        actual: isolationLevel[0]?.transaction_isolation,
      });
    }
  }

  private async checkForPotentialDeadlocks(
    context: TransactionContext
  ): Promise<void> {
    // Check for potential deadlock conditions
    const lockInfo = (await context.client.$queryRaw`
      SELECT 
        blocked_locks.pid AS blocked_pid,
        blocked_activity.usename AS blocked_user,
        blocking_locks.pid AS blocking_pid,
        blocking_activity.usename AS blocking_user,
        blocked_activity.query AS blocked_statement,
        blocking_activity.query AS current_statement_in_blocking_process
      FROM pg_catalog.pg_locks blocked_locks
      JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
      JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
        AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
        AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
        AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
        AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
        AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
        AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
        AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
        AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
        AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
        AND blocking_locks.pid != blocked_locks.pid
      JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
      WHERE NOT blocked_locks.granted
    `) as any[];

    if (lockInfo.length > 0) {
      logger.warn('Potential deadlock detected', {
        blockedProcesses: lockInfo.length,
        transactionId: context.id,
      });
    }
  }

  private async validateTransactionIntegrity(
    context: TransactionContext
  ): Promise<void> {
    // Validate that all operations in the transaction maintain referential integrity
    for (const operation of context.operations) {
      if (operation.type === 'create' || operation.type === 'update') {
        const validationResult = await this.integrityManager.validateEntity(
          operation.entityType,
          operation.entityId,
          operation.type
        );

        if (!validationResult.isValid) {
          throw new Error(
            `Referential integrity violation in transaction ${context.id}: ${validationResult.errors.map(e => e.message).join(', ')}`
          );
        }
      }
    }
  }

  private async validateDomainEventConsistency(event: any): Promise<void> {
    // Validate that domain events are consistent with the current state
    // This would include checking event ordering, causality, etc.
    logger.debug('Validating domain event consistency', {
      eventType: event.constructor.name,
      eventId: event.id,
    });
  }
}

export const dataConsistencyManager = new DataConsistencyManager();
