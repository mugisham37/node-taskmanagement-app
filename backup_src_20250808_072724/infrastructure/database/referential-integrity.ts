/**
 * Referential Integrity Management
 * Provides comprehensive referential integrity validation and constraint management
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from './prisma-client';
import { logger } from '../logging/logger';
import {
  ValidationResult,
  ValidationError,
} from '../../shared/validation/validation-engine';

export interface ReferentialConstraint {
  name: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  onDelete: 'CASCADE' | 'SET_NULL' | 'RESTRICT' | 'NO_ACTION';
  onUpdate: 'CASCADE' | 'SET_NULL' | 'RESTRICT' | 'NO_ACTION';
  isActive: boolean;
}

export interface IntegrityViolation {
  constraintName: string;
  violationType: 'FOREIGN_KEY' | 'UNIQUE' | 'CHECK' | 'NOT_NULL';
  table: string;
  column: string;
  value: any;
  referencedTable?: string;
  referencedColumn?: string;
  message: string;
}

export interface IntegrityCheckResult {
  isValid: boolean;
  violations: IntegrityViolation[];
  warnings: string[];
  checkedConstraints: number;
  executionTime: number;
}

export class ReferentialIntegrityManager {
  private constraints = new Map<string, ReferentialConstraint>();
  private customChecks = new Map<
    string,
    (client: PrismaClient) => Promise<IntegrityViolation[]>
  >();

  constructor(private readonly client: PrismaClient = prisma) {
    this.initializeSystemConstraints();
  }

  /**
   * Register referential constraint
   */
  registerConstraint(constraint: ReferentialConstraint): void {
    this.constraints.set(constraint.name, constraint);

    logger.debug('Referential constraint registered', {
      name: constraint.name,
      source: `${constraint.sourceTable}.${constraint.sourceColumn}`,
      target: `${constraint.targetTable}.${constraint.targetColumn}`,
      onDelete: constraint.onDelete,
      onUpdate: constraint.onUpdate,
    });
  }

  /**
   * Register custom integrity check
   */
  registerCustomCheck(
    name: string,
    check: (client: PrismaClient) => Promise<IntegrityViolation[]>
  ): void {
    this.customChecks.set(name, check);

    logger.debug('Custom integrity check registered', { name });
  }

  /**
   * Validate referential integrity for specific entity
   */
  async validateEntity(
    table: string,
    entityId: string,
    operation: 'create' | 'update' | 'delete'
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    try {
      // Get constraints for this table
      const relevantConstraints = Array.from(this.constraints.values()).filter(
        c => c.isActive && (c.sourceTable === table || c.targetTable === table)
      );

      for (const constraint of relevantConstraints) {
        const violations = await this.checkConstraint(
          constraint,
          table,
          entityId,
          operation
        );

        errors.push(
          ...violations.map(v => ({
            field: v.column,
            message: v.message,
            code: `REFERENTIAL_INTEGRITY_${v.violationType}`,
            value: v.value,
            context: {
              constraintName: v.constraintName,
              table: v.table,
              referencedTable: v.referencedTable,
              referencedColumn: v.referencedColumn,
            },
          }))
        );
      }

      const executionTime = Date.now() - startTime;

      logger.debug('Entity referential integrity validation completed', {
        table,
        entityId,
        operation,
        constraintsChecked: relevantConstraints.length,
        violations: errors.length,
        executionTime,
      });

      return {
        isValid: errors.length === 0,
        errors,
        warnings: warnings.map(w => ({
          field: 'integrity',
          message: w,
          code: 'INTEGRITY_WARNING',
        })),
      };
    } catch (error) {
      logger.error('Referential integrity validation failed', {
        table,
        entityId,
        operation,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        isValid: false,
        errors: [
          {
            field: 'integrity',
            message: 'Referential integrity validation failed',
            code: 'INTEGRITY_CHECK_ERROR',
            context: { error: String(error) },
          },
        ],
        warnings: [],
      };
    }
  }

  /**
   * Perform comprehensive integrity check on entire database
   */
  async performFullIntegrityCheck(): Promise<IntegrityCheckResult> {
    const startTime = Date.now();
    const violations: IntegrityViolation[] = [];
    const warnings: string[] = [];
    let checkedConstraints = 0;

    try {
      // Check all registered constraints
      for (const constraint of this.constraints.values()) {
        if (!constraint.isActive) continue;

        try {
          const constraintViolations =
            await this.checkFullConstraint(constraint);
          violations.push(...constraintViolations);
          checkedConstraints++;
        } catch (error) {
          warnings.push(
            `Failed to check constraint ${constraint.name}: ${error}`
          );
        }
      }

      // Run custom checks
      for (const [name, check] of this.customChecks.entries()) {
        try {
          const customViolations = await check(this.client);
          violations.push(...customViolations);
          checkedConstraints++;
        } catch (error) {
          warnings.push(`Failed to run custom check ${name}: ${error}`);
        }
      }

      // Check database-level constraints
      const dbViolations = await this.checkDatabaseConstraints();
      violations.push(...dbViolations);

      const executionTime = Date.now() - startTime;

      logger.info('Full integrity check completed', {
        violations: violations.length,
        warnings: warnings.length,
        checkedConstraints,
        executionTime,
      });

      return {
        isValid: violations.length === 0,
        violations,
        warnings,
        checkedConstraints,
        executionTime,
      };
    } catch (error) {
      logger.error('Full integrity check failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        isValid: false,
        violations: [
          {
            constraintName: 'SYSTEM_CHECK',
            violationType: 'CHECK',
            table: 'SYSTEM',
            column: 'SYSTEM',
            value: null,
            message: `Integrity check system error: ${error}`,
          },
        ],
        warnings,
        checkedConstraints,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Fix referential integrity violations automatically where possible
   */
  async fixViolations(violations: IntegrityViolation[]): Promise<{
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
        errors.push(
          `Failed to fix violation ${violation.constraintName}: ${error}`
        );
      }
    }

    logger.info('Violation fix attempt completed', {
      totalViolations: violations.length,
      fixed,
      failed,
      errors: errors.length,
    });

    return { fixed, failed, errors };
  }

  /**
   * Generate integrity report
   */
  async generateIntegrityReport(): Promise<{
    summary: {
      totalConstraints: number;
      activeConstraints: number;
      customChecks: number;
      lastCheckTime: Date;
    };
    constraintDetails: Array<{
      name: string;
      type: string;
      source: string;
      target: string;
      status: 'ACTIVE' | 'INACTIVE';
      lastChecked?: Date;
      violations?: number;
    }>;
    recommendations: string[];
  }> {
    const totalConstraints = this.constraints.size;
    const activeConstraints = Array.from(this.constraints.values()).filter(
      c => c.isActive
    ).length;
    const customChecks = this.customChecks.size;

    const constraintDetails = Array.from(this.constraints.values()).map(
      constraint => ({
        name: constraint.name,
        type: 'FOREIGN_KEY',
        source: `${constraint.sourceTable}.${constraint.sourceColumn}`,
        target: `${constraint.targetTable}.${constraint.targetColumn}`,
        status: constraint.isActive
          ? ('ACTIVE' as const)
          : ('INACTIVE' as const),
      })
    );

    const recommendations = await this.generateRecommendations();

    return {
      summary: {
        totalConstraints,
        activeConstraints,
        customChecks,
        lastCheckTime: new Date(),
      },
      constraintDetails,
      recommendations,
    };
  }

  private async checkConstraint(
    constraint: ReferentialConstraint,
    table: string,
    entityId: string,
    operation: 'create' | 'update' | 'delete'
  ): Promise<IntegrityViolation[]> {
    const violations: IntegrityViolation[] = [];

    try {
      if (constraint.sourceTable === table) {
        // Check if referenced entity exists
        const violations = await this.checkForeignKeyExists(
          constraint,
          entityId
        );
        return violations;
      }

      if (constraint.targetTable === table && operation === 'delete') {
        // Check if entity is referenced by others
        const violations = await this.checkReferencingEntities(
          constraint,
          entityId
        );
        return violations;
      }

      return violations;
    } catch (error) {
      logger.error('Constraint check failed', {
        constraintName: constraint.name,
        table,
        entityId,
        operation,
        error: error instanceof Error ? error.message : String(error),
      });

      return [
        {
          constraintName: constraint.name,
          violationType: 'CHECK',
          table,
          column: constraint.sourceColumn,
          value: entityId,
          message: `Constraint check failed: ${error}`,
        },
      ];
    }
  }

  private async checkForeignKeyExists(
    constraint: ReferentialConstraint,
    entityId: string
  ): Promise<IntegrityViolation[]> {
    // Get the foreign key value from the source entity
    const sourceEntity = (await this.client.$queryRaw`
      SELECT ${Prisma.raw(constraint.sourceColumn)} as fk_value
      FROM ${Prisma.raw(constraint.sourceTable)}
      WHERE id = ${entityId}
    `) as any[];

    if (sourceEntity.length === 0) {
      return [];
    }

    const fkValue = sourceEntity[0].fk_value;
    if (fkValue === null) {
      return []; // NULL foreign keys are allowed
    }

    // Check if referenced entity exists
    const referencedEntity = (await this.client.$queryRaw`
      SELECT 1
      FROM ${Prisma.raw(constraint.targetTable)}
      WHERE ${Prisma.raw(constraint.targetColumn)} = ${fkValue}
    `) as any[];

    if (referencedEntity.length === 0) {
      return [
        {
          constraintName: constraint.name,
          violationType: 'FOREIGN_KEY',
          table: constraint.sourceTable,
          column: constraint.sourceColumn,
          value: fkValue,
          referencedTable: constraint.targetTable,
          referencedColumn: constraint.targetColumn,
          message: `Foreign key violation: Referenced ${constraint.targetTable}.${constraint.targetColumn} = ${fkValue} does not exist`,
        },
      ];
    }

    return [];
  }

  private async checkReferencingEntities(
    constraint: ReferentialConstraint,
    entityId: string
  ): Promise<IntegrityViolation[]> {
    const referencingEntities = (await this.client.$queryRaw`
      SELECT id, ${Prisma.raw(constraint.sourceColumn)} as fk_value
      FROM ${Prisma.raw(constraint.sourceTable)}
      WHERE ${Prisma.raw(constraint.sourceColumn)} = ${entityId}
    `) as any[];

    if (referencingEntities.length > 0 && constraint.onDelete === 'RESTRICT') {
      return [
        {
          constraintName: constraint.name,
          violationType: 'FOREIGN_KEY',
          table: constraint.targetTable,
          column: constraint.targetColumn,
          value: entityId,
          referencedTable: constraint.sourceTable,
          referencedColumn: constraint.sourceColumn,
          message: `Cannot delete ${constraint.targetTable}.${constraint.targetColumn} = ${entityId}: ${referencingEntities.length} referencing records exist in ${constraint.sourceTable}`,
        },
      ];
    }

    return [];
  }

  private async checkFullConstraint(
    constraint: ReferentialConstraint
  ): Promise<IntegrityViolation[]> {
    const violations: IntegrityViolation[] = [];

    try {
      // Find all foreign key violations
      const violatingRecords = (await this.client.$queryRaw`
        SELECT s.id, s.${Prisma.raw(constraint.sourceColumn)} as fk_value
        FROM ${Prisma.raw(constraint.sourceTable)} s
        LEFT JOIN ${Prisma.raw(constraint.targetTable)} t 
          ON s.${Prisma.raw(constraint.sourceColumn)} = t.${Prisma.raw(constraint.targetColumn)}
        WHERE s.${Prisma.raw(constraint.sourceColumn)} IS NOT NULL 
          AND t.${Prisma.raw(constraint.targetColumn)} IS NULL
      `) as any[];

      for (const record of violatingRecords) {
        violations.push({
          constraintName: constraint.name,
          violationType: 'FOREIGN_KEY',
          table: constraint.sourceTable,
          column: constraint.sourceColumn,
          value: record.fk_value,
          referencedTable: constraint.targetTable,
          referencedColumn: constraint.targetColumn,
          message: `Foreign key violation: ${constraint.sourceTable}.${constraint.sourceColumn} = ${record.fk_value} references non-existent ${constraint.targetTable}.${constraint.targetColumn}`,
        });
      }
    } catch (error) {
      logger.error('Full constraint check failed', {
        constraintName: constraint.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return violations;
  }

  private async checkDatabaseConstraints(): Promise<IntegrityViolation[]> {
    const violations: IntegrityViolation[] = [];

    try {
      // Check for constraint violations at database level
      const constraintViolations = (await this.client.$queryRaw`
        SELECT 
          conname as constraint_name,
          contype as constraint_type,
          conrelid::regclass as table_name
        FROM pg_constraint 
        WHERE NOT convalidated
      `) as any[];

      for (const violation of constraintViolations) {
        violations.push({
          constraintName: violation.constraint_name,
          violationType: this.mapConstraintType(violation.constraint_type),
          table: violation.table_name,
          column: 'UNKNOWN',
          value: null,
          message: `Database constraint violation: ${violation.constraint_name} on ${violation.table_name}`,
        });
      }
    } catch (error) {
      logger.error('Database constraint check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return violations;
  }

  private async fixViolation(violation: IntegrityViolation): Promise<boolean> {
    try {
      switch (violation.violationType) {
        case 'FOREIGN_KEY':
          return await this.fixForeignKeyViolation(violation);
        case 'NOT_NULL':
          return await this.fixNotNullViolation(violation);
        default:
          logger.warn('Cannot auto-fix violation type', {
            type: violation.violationType,
            constraint: violation.constraintName,
          });
          return false;
      }
    } catch (error) {
      logger.error('Failed to fix violation', {
        violation: violation.constraintName,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private async fixForeignKeyViolation(
    violation: IntegrityViolation
  ): Promise<boolean> {
    // For foreign key violations, we can either:
    // 1. Set the foreign key to NULL (if allowed)
    // 2. Delete the violating record
    // 3. Create the missing referenced record (not recommended)

    const constraint = this.constraints.get(violation.constraintName);
    if (!constraint) return false;

    if (constraint.onDelete === 'SET_NULL') {
      await this.client.$executeRaw`
        UPDATE ${Prisma.raw(violation.table)}
        SET ${Prisma.raw(violation.column)} = NULL
        WHERE ${Prisma.raw(violation.column)} = ${violation.value}
      `;
      return true;
    }

    return false;
  }

  private async fixNotNullViolation(
    violation: IntegrityViolation
  ): Promise<boolean> {
    // For NOT NULL violations, we need to provide a default value
    // This is highly context-dependent and should be handled carefully
    logger.warn('NOT NULL violation requires manual intervention', {
      table: violation.table,
      column: violation.column,
    });
    return false;
  }

  private mapConstraintType(
    pgConstraintType: string
  ): IntegrityViolation['violationType'] {
    switch (pgConstraintType) {
      case 'f':
        return 'FOREIGN_KEY';
      case 'u':
        return 'UNIQUE';
      case 'c':
        return 'CHECK';
      case 'n':
        return 'NOT_NULL';
      default:
        return 'CHECK';
    }
  }

  private async generateRecommendations(): Promise<string[]> {
    const recommendations: string[] = [];

    // Check for missing indexes on foreign keys
    const missingIndexes = await this.findMissingForeignKeyIndexes();
    if (missingIndexes.length > 0) {
      recommendations.push(
        `Consider adding indexes on foreign key columns: ${missingIndexes.join(', ')}`
      );
    }

    // Check for unused constraints
    const unusedConstraints = Array.from(this.constraints.values()).filter(
      c => !c.isActive
    );
    if (unusedConstraints.length > 0) {
      recommendations.push(
        `${unusedConstraints.length} constraints are inactive and could be removed`
      );
    }

    return recommendations;
  }

  private async findMissingForeignKeyIndexes(): Promise<string[]> {
    try {
      const missingIndexes = (await this.client.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          attname as column_name
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        LEFT JOIN pg_index i ON i.indrelid = c.conrelid 
          AND a.attnum = ANY(i.indkey)
        WHERE c.contype = 'f'
          AND i.indrelid IS NULL
          AND n.nspname = 'public'
      `) as any[];

      return missingIndexes.map(idx => `${idx.tablename}.${idx.column_name}`);
    } catch (error) {
      logger.error('Failed to find missing indexes', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private initializeSystemConstraints(): void {
    // Register core system constraints
    const systemConstraints: ReferentialConstraint[] = [
      {
        name: 'fk_tasks_workspace',
        sourceTable: 'tasks',
        sourceColumn: 'workspace_id',
        targetTable: 'workspaces',
        targetColumn: 'id',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        isActive: true,
      },
      {
        name: 'fk_tasks_project',
        sourceTable: 'tasks',
        sourceColumn: 'project_id',
        targetTable: 'projects',
        targetColumn: 'id',
        onDelete: 'SET_NULL',
        onUpdate: 'CASCADE',
        isActive: true,
      },
      {
        name: 'fk_tasks_assignee',
        sourceTable: 'tasks',
        sourceColumn: 'assignee_id',
        targetTable: 'users',
        targetColumn: 'id',
        onDelete: 'SET_NULL',
        onUpdate: 'CASCADE',
        isActive: true,
      },
      {
        name: 'fk_tasks_creator',
        sourceTable: 'tasks',
        sourceColumn: 'creator_id',
        targetTable: 'users',
        targetColumn: 'id',
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
        isActive: true,
      },
      {
        name: 'fk_projects_workspace',
        sourceTable: 'projects',
        sourceColumn: 'workspace_id',
        targetTable: 'workspaces',
        targetColumn: 'id',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        isActive: true,
      },
      {
        name: 'fk_projects_owner',
        sourceTable: 'projects',
        sourceColumn: 'owner_id',
        targetTable: 'users',
        targetColumn: 'id',
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
        isActive: true,
      },
      {
        name: 'fk_workspace_members_workspace',
        sourceTable: 'workspace_members',
        sourceColumn: 'workspace_id',
        targetTable: 'workspaces',
        targetColumn: 'id',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        isActive: true,
      },
      {
        name: 'fk_workspace_members_user',
        sourceTable: 'workspace_members',
        sourceColumn: 'user_id',
        targetTable: 'users',
        targetColumn: 'id',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        isActive: true,
      },
    ];

    systemConstraints.forEach(constraint => {
      this.registerConstraint(constraint);
    });

    logger.info('System referential constraints initialized', {
      count: systemConstraints.length,
    });
  }
}

export const referentialIntegrityManager = new ReferentialIntegrityManager();
