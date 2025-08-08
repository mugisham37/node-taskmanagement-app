/**
 * Reversible Database Migration System
 * Provides comprehensive database migration management with rollback capabilities
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from './prisma-client';
import { logger } from '../logging/logger';
import { readFile, writeFile, readdir } from 'fs/promises';
import { join } from 'path';

export interface Migration {
  id: string;
  name: string;
  version: string;
  description: string;
  up: string;
  down: string;
  checksum: string;
  appliedAt?: Date;
  rolledBackAt?: Date;
  executionTime?: number;
  dependencies: string[];
  tags: string[];
}

export interface MigrationResult {
  success: boolean;
  migration: Migration;
  executionTime: number;
  error?: string;
  warnings: string[];
}

export interface MigrationPlan {
  id: string;
  migrations: Migration[];
  direction: 'up' | 'down';
  dryRun: boolean;
  createdAt: Date;
  estimatedTime: number;
}

export interface MigrationStatus {
  totalMigrations: number;
  appliedMigrations: number;
  pendingMigrations: number;
  failedMigrations: number;
  lastMigration?: Migration;
  databaseVersion: string;
}

export class MigrationSystem {
  private migrationsPath: string;
  private migrationTable = '_migrations';

  constructor(
    private readonly client: PrismaClient = prisma,
    migrationsPath: string = './prisma/migrations'
  ) {
    this.migrationsPath = migrationsPath;
  }

  /**
   * Initialize migration system
   */
  async initialize(): Promise<void> {
    await this.ensureMigrationTable();
    logger.info('Migration system initialized');
  }

  /**
   * Load all migrations from filesystem
   */
  async loadMigrations(): Promise<Migration[]> {
    try {
      const migrationDirs = await readdir(this.migrationsPath);
      const migrations: Migration[] = [];

      for (const dir of migrationDirs) {
        if (!dir.match(/^\d{14}_/)) continue; // Skip non-migration directories

        const migrationPath = join(this.migrationsPath, dir);
        const migration = await this.loadMigration(migrationPath);

        if (migration) {
          migrations.push(migration);
        }
      }

      // Sort by version
      migrations.sort((a, b) => a.version.localeCompare(b.version));

      logger.debug('Migrations loaded', { count: migrations.length });
      return migrations;
    } catch (error) {
      logger.error('Failed to load migrations', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get migration status
   */
  async getStatus(): Promise<MigrationStatus> {
    const allMigrations = await this.loadMigrations();
    const appliedMigrations = await this.getAppliedMigrations();
    const appliedIds = new Set(appliedMigrations.map(m => m.id));

    const pendingMigrations = allMigrations.filter(m => !appliedIds.has(m.id));
    const failedMigrations = appliedMigrations.filter(m => m.rolledBackAt);

    const lastMigration = appliedMigrations
      .filter(m => !m.rolledBackAt)
      .sort(
        (a, b) => (b.appliedAt?.getTime() || 0) - (a.appliedAt?.getTime() || 0)
      )[0];

    return {
      totalMigrations: allMigrations.length,
      appliedMigrations: appliedMigrations.filter(m => !m.rolledBackAt).length,
      pendingMigrations: pendingMigrations.length,
      failedMigrations: failedMigrations.length,
      lastMigration,
      databaseVersion: lastMigration?.version || '0',
    };
  }

  /**
   * Create migration plan
   */
  async createMigrationPlan(
    targetVersion?: string,
    direction: 'up' | 'down' = 'up',
    dryRun: boolean = false
  ): Promise<MigrationPlan> {
    const allMigrations = await this.loadMigrations();
    const appliedMigrations = await this.getAppliedMigrations();
    const appliedIds = new Set(appliedMigrations.map(m => m.id));

    let migrations: Migration[];

    if (direction === 'up') {
      migrations = allMigrations.filter(m => !appliedIds.has(m.id));

      if (targetVersion) {
        migrations = migrations.filter(m => m.version <= targetVersion);
      }
    } else {
      migrations = appliedMigrations
        .filter(m => !m.rolledBackAt)
        .sort((a, b) => b.version.localeCompare(a.version));

      if (targetVersion) {
        migrations = migrations.filter(m => m.version > targetVersion);
      }
    }

    // Validate dependencies
    await this.validateDependencies(migrations, direction);

    const estimatedTime = this.estimateExecutionTime(migrations);

    const plan: MigrationPlan = {
      id: this.generatePlanId(),
      migrations,
      direction,
      dryRun,
      createdAt: new Date(),
      estimatedTime,
    };

    logger.info('Migration plan created', {
      planId: plan.id,
      direction,
      migrationCount: migrations.length,
      estimatedTime,
      dryRun,
    });

    return plan;
  }

  /**
   * Execute migration plan
   */
  async executePlan(plan: MigrationPlan): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];

    logger.info('Executing migration plan', {
      planId: plan.id,
      direction: plan.direction,
      migrationCount: plan.migrations.length,
      dryRun: plan.dryRun,
    });

    for (const migration of plan.migrations) {
      try {
        const result = await this.executeMigration(
          migration,
          plan.direction,
          plan.dryRun
        );
        results.push(result);

        if (!result.success) {
          logger.error('Migration failed, stopping execution', {
            planId: plan.id,
            migrationId: migration.id,
            error: result.error,
          });
          break;
        }
      } catch (error) {
        const result: MigrationResult = {
          success: false,
          migration,
          executionTime: 0,
          error: error instanceof Error ? error.message : String(error),
          warnings: [],
        };
        results.push(result);
        break;
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalTime = results.reduce((sum, r) => sum + r.executionTime, 0);

    logger.info('Migration plan execution completed', {
      planId: plan.id,
      successCount,
      totalCount: results.length,
      totalTime,
      dryRun: plan.dryRun,
    });

    return results;
  }

  /**
   * Execute single migration
   */
  async executeMigration(
    migration: Migration,
    direction: 'up' | 'down',
    dryRun: boolean = false
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    logger.info('Executing migration', {
      migrationId: migration.id,
      name: migration.name,
      direction,
      dryRun,
    });

    try {
      const sql = direction === 'up' ? migration.up : migration.down;

      if (!sql.trim()) {
        throw new Error(`No ${direction} migration script found`);
      }

      // Validate SQL before execution
      const validationWarnings = await this.validateSQL(sql);
      warnings.push(...validationWarnings);

      if (dryRun) {
        logger.info('Dry run - migration would execute', {
          migrationId: migration.id,
          sql: sql.substring(0, 200) + '...',
        });
      } else {
        // Execute within transaction
        await this.client.$transaction(async tx => {
          // Execute migration SQL
          await tx.$executeRawUnsafe(sql);

          // Update migration record
          if (direction === 'up') {
            await this.recordMigrationApplied(tx, migration);
          } else {
            await this.recordMigrationRolledBack(tx, migration);
          }
        });
      }

      const executionTime = Date.now() - startTime;

      logger.info('Migration executed successfully', {
        migrationId: migration.id,
        direction,
        executionTime,
        dryRun,
      });

      return {
        success: true,
        migration,
        executionTime,
        warnings,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error('Migration execution failed', {
        migrationId: migration.id,
        direction,
        executionTime,
        error: errorMessage,
      });

      return {
        success: false,
        migration,
        executionTime,
        error: errorMessage,
        warnings,
      };
    }
  }

  /**
   * Rollback to specific version
   */
  async rollbackToVersion(
    targetVersion: string,
    dryRun: boolean = false
  ): Promise<MigrationResult[]> {
    const plan = await this.createMigrationPlan(targetVersion, 'down', dryRun);
    return await this.executePlan(plan);
  }

  /**
   * Rollback last N migrations
   */
  async rollbackLast(
    count: number = 1,
    dryRun: boolean = false
  ): Promise<MigrationResult[]> {
    const appliedMigrations = await this.getAppliedMigrations();
    const migrationsToRollback = appliedMigrations
      .filter(m => !m.rolledBackAt)
      .sort((a, b) => b.version.localeCompare(a.version))
      .slice(0, count);

    const plan: MigrationPlan = {
      id: this.generatePlanId(),
      migrations: migrationsToRollback,
      direction: 'down',
      dryRun,
      createdAt: new Date(),
      estimatedTime: this.estimateExecutionTime(migrationsToRollback),
    };

    return await this.executePlan(plan);
  }

  /**
   * Create new migration
   */
  async createMigration(
    name: string,
    description: string,
    upSQL: string,
    downSQL: string,
    dependencies: string[] = [],
    tags: string[] = []
  ): Promise<Migration> {
    const version = this.generateVersion();
    const id = `${version}_${name.toLowerCase().replace(/\s+/g, '_')}`;
    const checksum = this.calculateChecksum(upSQL + downSQL);

    const migration: Migration = {
      id,
      name,
      version,
      description,
      up: upSQL,
      down: downSQL,
      checksum,
      dependencies,
      tags,
    };

    // Create migration directory and files
    const migrationDir = join(this.migrationsPath, id);
    await this.saveMigrationFiles(migrationDir, migration);

    logger.info('Migration created', {
      migrationId: id,
      name,
      version,
    });

    return migration;
  }

  /**
   * Validate migration integrity
   */
  async validateIntegrity(): Promise<{
    valid: boolean;
    issues: Array<{
      type: 'checksum_mismatch' | 'missing_file' | 'dependency_missing';
      migrationId: string;
      message: string;
    }>;
  }> {
    const issues: Array<{
      type: 'checksum_mismatch' | 'missing_file' | 'dependency_missing';
      migrationId: string;
      message: string;
    }> = [];

    const appliedMigrations = await this.getAppliedMigrations();
    const fileMigrations = await this.loadMigrations();
    const fileMap = new Map(fileMigrations.map(m => [m.id, m]));

    for (const applied of appliedMigrations) {
      const file = fileMap.get(applied.id);

      if (!file) {
        issues.push({
          type: 'missing_file',
          migrationId: applied.id,
          message: 'Migration file not found',
        });
        continue;
      }

      if (file.checksum !== applied.checksum) {
        issues.push({
          type: 'checksum_mismatch',
          migrationId: applied.id,
          message: 'Migration file has been modified after application',
        });
      }

      // Check dependencies
      for (const depId of file.dependencies) {
        const dependency = appliedMigrations.find(
          m => m.id === depId && !m.rolledBackAt
        );
        if (!dependency) {
          issues.push({
            type: 'dependency_missing',
            migrationId: applied.id,
            message: `Dependency ${depId} not found or rolled back`,
          });
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Get migration history
   */
  async getHistory(limit: number = 50): Promise<Migration[]> {
    const appliedMigrations = await this.getAppliedMigrations();

    return appliedMigrations
      .sort(
        (a, b) => (b.appliedAt?.getTime() || 0) - (a.appliedAt?.getTime() || 0)
      )
      .slice(0, limit);
  }

  private async ensureMigrationTable(): Promise<void> {
    await this.client.$executeRaw`
      CREATE TABLE IF NOT EXISTS ${Prisma.raw(this.migrationTable)} (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        version VARCHAR(50) NOT NULL,
        description TEXT,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        rolled_back_at TIMESTAMP NULL,
        execution_time INTEGER,
        dependencies TEXT[],
        tags TEXT[]
      )
    `;

    await this.client.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_migrations_version 
      ON ${Prisma.raw(this.migrationTable)} (version)
    `;

    await this.client.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_migrations_applied_at 
      ON ${Prisma.raw(this.migrationTable)} (applied_at)
    `;
  }

  private async loadMigration(
    migrationPath: string
  ): Promise<Migration | null> {
    try {
      const metadataPath = join(migrationPath, 'migration.json');
      const upPath = join(migrationPath, 'migration.sql');
      const downPath = join(migrationPath, 'rollback.sql');

      const [metadata, upSQL, downSQL] = await Promise.all([
        readFile(metadataPath, 'utf-8').then(JSON.parse),
        readFile(upPath, 'utf-8'),
        readFile(downPath, 'utf-8'),
      ]);

      return {
        ...metadata,
        up: upSQL,
        down: downSQL,
        checksum: this.calculateChecksum(upSQL + downSQL),
      };
    } catch (error) {
      logger.warn('Failed to load migration', {
        path: migrationPath,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async getAppliedMigrations(): Promise<Migration[]> {
    const records = await this.client.$queryRaw<any[]>`
      SELECT * FROM ${Prisma.raw(this.migrationTable)}
      ORDER BY applied_at ASC
    `;

    return records.map(record => ({
      id: record.id,
      name: record.name,
      version: record.version,
      description: record.description,
      up: '',
      down: '',
      checksum: record.checksum,
      appliedAt: record.applied_at,
      rolledBackAt: record.rolled_back_at,
      executionTime: record.execution_time,
      dependencies: record.dependencies || [],
      tags: record.tags || [],
    }));
  }

  private async recordMigrationApplied(
    tx: Prisma.TransactionClient,
    migration: Migration
  ): Promise<void> {
    await tx.$executeRaw`
      INSERT INTO ${Prisma.raw(this.migrationTable)} 
      (id, name, version, description, checksum, dependencies, tags)
      VALUES (
        ${migration.id},
        ${migration.name},
        ${migration.version},
        ${migration.description},
        ${migration.checksum},
        ${migration.dependencies},
        ${migration.tags}
      )
      ON CONFLICT (id) DO UPDATE SET
        rolled_back_at = NULL,
        applied_at = CURRENT_TIMESTAMP
    `;
  }

  private async recordMigrationRolledBack(
    tx: Prisma.TransactionClient,
    migration: Migration
  ): Promise<void> {
    await tx.$executeRaw`
      UPDATE ${Prisma.raw(this.migrationTable)}
      SET rolled_back_at = CURRENT_TIMESTAMP
      WHERE id = ${migration.id}
    `;
  }

  private async validateDependencies(
    migrations: Migration[],
    direction: 'up' | 'down'
  ): Promise<void> {
    if (direction === 'up') {
      const migrationIds = new Set(migrations.map(m => m.id));
      const appliedMigrations = await this.getAppliedMigrations();
      const appliedIds = new Set(
        appliedMigrations.filter(m => !m.rolledBackAt).map(m => m.id)
      );

      for (const migration of migrations) {
        for (const depId of migration.dependencies) {
          if (!appliedIds.has(depId) && !migrationIds.has(depId)) {
            throw new Error(
              `Migration ${migration.id} depends on ${depId} which is not applied or included`
            );
          }
        }
      }
    }
  }

  private async validateSQL(sql: string): Promise<string[]> {
    const warnings: string[] = [];

    // Check for potentially dangerous operations
    const dangerousPatterns = [
      /DROP\s+TABLE/i,
      /DROP\s+COLUMN/i,
      /TRUNCATE/i,
      /DELETE\s+FROM.*WHERE/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(sql)) {
        warnings.push(
          `Potentially dangerous operation detected: ${pattern.source}`
        );
      }
    }

    return warnings;
  }

  private estimateExecutionTime(migrations: Migration[]): number {
    // Simple estimation based on SQL complexity
    return migrations.reduce((total, migration) => {
      const sqlLength = migration.up.length + migration.down.length;
      return total + Math.max(1000, sqlLength / 100); // Minimum 1 second per migration
    }, 0);
  }

  private generateVersion(): string {
    const now = new Date();
    return now
      .toISOString()
      .replace(/[-:T]/g, '')
      .replace(/\.\d{3}Z$/, '');
  }

  private generatePlanId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `plan_${timestamp}_${random}`;
  }

  private calculateChecksum(content: string): string {
    // Simple checksum calculation (in production, use crypto.createHash)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  private async saveMigrationFiles(
    migrationDir: string,
    migration: Migration
  ): Promise<void> {
    const { mkdir } = await import('fs/promises');

    await mkdir(migrationDir, { recursive: true });

    const metadata = {
      id: migration.id,
      name: migration.name,
      version: migration.version,
      description: migration.description,
      dependencies: migration.dependencies,
      tags: migration.tags,
    };

    await Promise.all([
      writeFile(
        join(migrationDir, 'migration.json'),
        JSON.stringify(metadata, null, 2)
      ),
      writeFile(join(migrationDir, 'migration.sql'), migration.up),
      writeFile(join(migrationDir, 'rollback.sql'), migration.down),
    ]);
  }
}

export const migrationSystem = new MigrationSystem();
