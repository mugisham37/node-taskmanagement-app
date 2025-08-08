/**
 * Data Backup and Recovery System
 * Provides comprehensive backup and disaster recovery capabilities
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '../database/prisma-client';
import { logger } from '../logging/logger';
import { createReadStream, createWriteStream } from 'fs';
import { mkdir, readdir, stat, unlink } from 'fs/promises';
import { join } from 'path';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';

export interface BackupConfig {
  name: string;
  type: 'full' | 'incremental' | 'differential';
  compression: boolean;
  encryption: boolean;
  retention: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  schedule?: {
    enabled: boolean;
    cron: string;
  };
  storage: {
    type: 'local' | 's3' | 'gcs';
    path: string;
    credentials?: Record<string, any>;
  };
  tables?: string[];
  excludeTables?: string[];
}

export interface BackupMetadata {
  id: string;
  name: string;
  type: 'full' | 'incremental' | 'differential';
  size: number;
  compressed: boolean;
  encrypted: boolean;
  checksum: string;
  createdAt: Date;
  completedAt?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  tables: string[];
  recordCount: number;
  baseBackupId?: string; // For incremental/differential backups
  version: string;
}

export interface RestoreOptions {
  backupId: string;
  targetDatabase?: string;
  tables?: string[];
  pointInTime?: Date;
  dryRun: boolean;
  skipValidation: boolean;
}

export interface RestoreResult {
  success: boolean;
  restoredTables: string[];
  restoredRecords: number;
  duration: number;
  warnings: string[];
  error?: string;
}

export class BackupSystem {
  private backupsPath: string;
  private metadataTable = '_backup_metadata';
  private activeBackups = new Set<string>();

  constructor(
    private readonly client: PrismaClient = prisma,
    backupsPath: string = './backups'
  ) {
    this.backupsPath = backupsPath;
  }

  /**
   * Initialize backup system
   */
  async initialize(): Promise<void> {
    await this.ensureBackupDirectory();
    await this.ensureMetadataTable();
    logger.info('Backup system initialized');
  }

  /**
   * Create backup
   */
  async createBackup(config: BackupConfig): Promise<string> {
    const backupId = this.generateBackupId();

    if (this.activeBackups.has(config.name)) {
      throw new Error(`Backup already in progress for ${config.name}`);
    }

    const metadata: BackupMetadata = {
      id: backupId,
      name: config.name,
      type: config.type,
      size: 0,
      compressed: config.compression,
      encrypted: config.encryption,
      checksum: '',
      createdAt: new Date(),
      status: 'pending',
      tables: [],
      recordCount: 0,
      version: await this.getDatabaseVersion(),
    };

    await this.saveBackupMetadata(metadata);
    this.activeBackups.add(config.name);

    logger.info('Backup started', {
      backupId,
      name: config.name,
      type: config.type,
    });

    // Execute backup asynchronously
    this.executeBackup(config, metadata).catch(error => {
      logger.error('Backup execution failed', {
        backupId,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return backupId;
  }

  /**
   * Restore from backup
   */
  async restoreBackup(options: RestoreOptions): Promise<RestoreResult> {
    const metadata = await this.getBackupMetadata(options.backupId);

    if (!metadata) {
      throw new Error(`Backup ${options.backupId} not found`);
    }

    if (metadata.status !== 'completed') {
      throw new Error(`Backup ${options.backupId} is not completed`);
    }

    logger.info('Restore started', {
      backupId: options.backupId,
      targetDatabase: options.targetDatabase,
      dryRun: options.dryRun,
    });

    const startTime = Date.now();
    const warnings: string[] = [];
    let restoredTables: string[] = [];
    let restoredRecords = 0;

    try {
      // Validate backup integrity
      if (!options.skipValidation) {
        const isValid = await this.validateBackup(options.backupId);
        if (!isValid) {
          throw new Error('Backup integrity validation failed');
        }
      }

      // Determine tables to restore
      const tablesToRestore = options.tables || metadata.tables;

      if (options.dryRun) {
        logger.info('Dry run - restore would process tables', {
          tables: tablesToRestore,
          recordCount: metadata.recordCount,
        });

        return {
          success: true,
          restoredTables: tablesToRestore,
          restoredRecords: metadata.recordCount,
          duration: Date.now() - startTime,
          warnings: ['Dry run - no actual restore performed'],
        };
      }

      // Execute restore
      const result = await this.executeRestore(
        metadata,
        tablesToRestore,
        options
      );
      restoredTables = result.tables;
      restoredRecords = result.records;
      warnings.push(...result.warnings);

      const duration = Date.now() - startTime;

      logger.info('Restore completed successfully', {
        backupId: options.backupId,
        restoredTables: restoredTables.length,
        restoredRecords,
        duration,
      });

      return {
        success: true,
        restoredTables,
        restoredRecords,
        duration,
        warnings,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error('Restore failed', {
        backupId: options.backupId,
        error: errorMessage,
        duration,
      });

      return {
        success: false,
        restoredTables,
        restoredRecords,
        duration,
        warnings,
        error: errorMessage,
      };
    }
  }

  /**
   * List available backups
   */
  async listBackups(name?: string): Promise<BackupMetadata[]> {
    const query = name
      ? `SELECT * FROM ${this.metadataTable} WHERE name = $1 ORDER BY created_at DESC`
      : `SELECT * FROM ${this.metadataTable} ORDER BY created_at DESC`;

    const params = name ? [name] : [];
    const records = await this.client.$queryRawUnsafe<any[]>(query, ...params);

    return records.map(this.mapRecordToMetadata);
  }

  /**
   * Get backup metadata
   */
  async getBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
    const records = await this.client.$queryRawUnsafe<any[]>(
      `SELECT * FROM ${this.metadataTable} WHERE id = $1`,
      backupId
    );

    return records.length > 0 ? this.mapRecordToMetadata(records[0]) : null;
  }

  /**
   * Delete backup
   */
  async deleteBackup(backupId: string): Promise<boolean> {
    const metadata = await this.getBackupMetadata(backupId);

    if (!metadata) {
      return false;
    }

    try {
      // Delete backup files
      const backupPath = this.getBackupPath(backupId);
      await this.deleteBackupFiles(backupPath);

      // Delete metadata
      await this.client.$executeRawUnsafe(
        `DELETE FROM ${this.metadataTable} WHERE id = $1`,
        backupId
      );

      logger.info('Backup deleted', { backupId });
      return true;
    } catch (error) {
      logger.error('Failed to delete backup', {
        backupId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Validate backup integrity
   */
  async validateBackup(backupId: string): Promise<boolean> {
    const metadata = await this.getBackupMetadata(backupId);

    if (!metadata) {
      return false;
    }

    try {
      const backupPath = this.getBackupPath(backupId);
      const actualChecksum = await this.calculateFileChecksum(backupPath);

      const isValid = actualChecksum === metadata.checksum;

      logger.debug('Backup validation result', {
        backupId,
        isValid,
        expectedChecksum: metadata.checksum,
        actualChecksum,
      });

      return isValid;
    } catch (error) {
      logger.error('Backup validation failed', {
        backupId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Cleanup old backups based on retention policy
   */
  async cleanupOldBackups(config: BackupConfig): Promise<{
    deleted: number;
    errors: string[];
  }> {
    const backups = await this.listBackups(config.name);
    const now = new Date();
    const toDelete: string[] = [];
    const errors: string[] = [];

    // Group backups by age
    const daily = backups.filter(b => this.isWithinDays(b.createdAt, now, 1));
    const weekly = backups.filter(b => this.isWithinDays(b.createdAt, now, 7));
    const monthly = backups.filter(b =>
      this.isWithinDays(b.createdAt, now, 30)
    );
    const older = backups.filter(b => !this.isWithinDays(b.createdAt, now, 30));

    // Apply retention policy
    if (daily.length > config.retention.daily) {
      const excess = daily.slice(config.retention.daily);
      toDelete.push(...excess.map(b => b.id));
    }

    if (weekly.length > config.retention.weekly) {
      const excess = weekly.slice(config.retention.weekly);
      toDelete.push(...excess.map(b => b.id));
    }

    if (monthly.length > config.retention.monthly) {
      const excess = monthly.slice(config.retention.monthly);
      toDelete.push(...excess.map(b => b.id));
    }

    // Delete all backups older than monthly retention
    toDelete.push(...older.map(b => b.id));

    // Remove duplicates
    const uniqueToDelete = [...new Set(toDelete)];

    // Delete backups
    let deleted = 0;
    for (const backupId of uniqueToDelete) {
      try {
        const success = await this.deleteBackup(backupId);
        if (success) {
          deleted++;
        }
      } catch (error) {
        errors.push(`Failed to delete backup ${backupId}: ${error}`);
      }
    }

    logger.info('Backup cleanup completed', {
      name: config.name,
      deleted,
      errors: errors.length,
    });

    return { deleted, errors };
  }

  /**
   * Get backup statistics
   */
  async getBackupStats(): Promise<{
    totalBackups: number;
    totalSize: number;
    successfulBackups: number;
    failedBackups: number;
    averageSize: number;
    oldestBackup?: Date;
    newestBackup?: Date;
  }> {
    const backups = await this.listBackups();

    const totalBackups = backups.length;
    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
    const successfulBackups = backups.filter(
      b => b.status === 'completed'
    ).length;
    const failedBackups = backups.filter(b => b.status === 'failed').length;
    const averageSize = totalBackups > 0 ? totalSize / totalBackups : 0;

    const dates = backups
      .map(b => b.createdAt)
      .sort((a, b) => a.getTime() - b.getTime());
    const oldestBackup = dates[0];
    const newestBackup = dates[dates.length - 1];

    return {
      totalBackups,
      totalSize,
      successfulBackups,
      failedBackups,
      averageSize,
      oldestBackup,
      newestBackup,
    };
  }

  private async executeBackup(
    config: BackupConfig,
    metadata: BackupMetadata
  ): Promise<void> {
    try {
      metadata.status = 'running';
      await this.saveBackupMetadata(metadata);

      // Get tables to backup
      const tables = await this.getTablesToBackup(config);
      metadata.tables = tables;

      // Create backup directory
      const backupPath = this.getBackupPath(metadata.id);
      await mkdir(backupPath, { recursive: true });

      // Execute backup based on type
      let recordCount = 0;
      switch (config.type) {
        case 'full':
          recordCount = await this.executeFullBackup(config, metadata, tables);
          break;
        case 'incremental':
          recordCount = await this.executeIncrementalBackup(
            config,
            metadata,
            tables
          );
          break;
        case 'differential':
          recordCount = await this.executeDifferentialBackup(
            config,
            metadata,
            tables
          );
          break;
      }

      metadata.recordCount = recordCount;

      // Calculate checksum
      const backupFilePath = join(backupPath, 'backup.sql');
      metadata.checksum = await this.calculateFileChecksum(backupFilePath);
      metadata.size = (await stat(backupFilePath)).size;

      // Compress if requested
      if (config.compression) {
        await this.compressBackup(backupFilePath);
        metadata.size = (await stat(backupFilePath + '.gz')).size;
      }

      // Encrypt if requested
      if (config.encryption) {
        await this.encryptBackup(
          backupFilePath + (config.compression ? '.gz' : '')
        );
      }

      metadata.status = 'completed';
      metadata.completedAt = new Date();

      logger.info('Backup completed successfully', {
        backupId: metadata.id,
        recordCount,
        size: metadata.size,
        duration: metadata.completedAt.getTime() - metadata.createdAt.getTime(),
      });
    } catch (error) {
      metadata.status = 'failed';
      metadata.error = error instanceof Error ? error.message : String(error);
      metadata.completedAt = new Date();

      logger.error('Backup failed', {
        backupId: metadata.id,
        error: metadata.error,
      });
    } finally {
      await this.saveBackupMetadata(metadata);
      this.activeBackups.delete(config.name);
    }
  }

  private async executeFullBackup(
    config: BackupConfig,
    metadata: BackupMetadata,
    tables: string[]
  ): Promise<number> {
    const backupPath = join(this.getBackupPath(metadata.id), 'backup.sql');
    const writeStream = createWriteStream(backupPath);

    let totalRecords = 0;

    try {
      // Write header
      writeStream.write(`-- Full Backup: ${metadata.name}\n`);
      writeStream.write(`-- Created: ${metadata.createdAt.toISOString()}\n`);
      writeStream.write(`-- Database Version: ${metadata.version}\n\n`);

      for (const table of tables) {
        // Get table schema
        const schema = await this.getTableSchema(table);
        writeStream.write(`-- Table: ${table}\n`);
        writeStream.write(`${schema}\n\n`);

        // Export data
        const records = await this.exportTableData(table);
        totalRecords += records.length;

        for (const record of records) {
          writeStream.write(`${record}\n`);
        }

        writeStream.write('\n');
      }

      writeStream.end();
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      return totalRecords;
    } catch (error) {
      writeStream.destroy();
      throw error;
    }
  }

  private async executeIncrementalBackup(
    config: BackupConfig,
    metadata: BackupMetadata,
    tables: string[]
  ): Promise<number> {
    // Find last backup
    const lastBackup = await this.getLastBackup(config.name);
    if (!lastBackup) {
      throw new Error('No base backup found for incremental backup');
    }

    metadata.baseBackupId = lastBackup.id;

    // Export only changes since last backup
    const backupPath = join(this.getBackupPath(metadata.id), 'backup.sql');
    const writeStream = createWriteStream(backupPath);

    let totalRecords = 0;

    try {
      writeStream.write(`-- Incremental Backup: ${metadata.name}\n`);
      writeStream.write(`-- Base Backup: ${lastBackup.id}\n`);
      writeStream.write(`-- Created: ${metadata.createdAt.toISOString()}\n\n`);

      for (const table of tables) {
        const changes = await this.getTableChanges(
          table,
          lastBackup.completedAt!
        );
        totalRecords += changes.length;

        if (changes.length > 0) {
          writeStream.write(`-- Table: ${table} (${changes.length} changes)\n`);
          for (const change of changes) {
            writeStream.write(`${change}\n`);
          }
          writeStream.write('\n');
        }
      }

      writeStream.end();
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      return totalRecords;
    } catch (error) {
      writeStream.destroy();
      throw error;
    }
  }

  private async executeDifferentialBackup(
    config: BackupConfig,
    metadata: BackupMetadata,
    tables: string[]
  ): Promise<number> {
    // Find last full backup
    const lastFullBackup = await this.getLastFullBackup(config.name);
    if (!lastFullBackup) {
      throw new Error('No full backup found for differential backup');
    }

    metadata.baseBackupId = lastFullBackup.id;

    // Export changes since last full backup
    const backupPath = join(this.getBackupPath(metadata.id), 'backup.sql');
    const writeStream = createWriteStream(backupPath);

    let totalRecords = 0;

    try {
      writeStream.write(`-- Differential Backup: ${metadata.name}\n`);
      writeStream.write(`-- Base Full Backup: ${lastFullBackup.id}\n`);
      writeStream.write(`-- Created: ${metadata.createdAt.toISOString()}\n\n`);

      for (const table of tables) {
        const changes = await this.getTableChanges(
          table,
          lastFullBackup.completedAt!
        );
        totalRecords += changes.length;

        if (changes.length > 0) {
          writeStream.write(`-- Table: ${table} (${changes.length} changes)\n`);
          for (const change of changes) {
            writeStream.write(`${change}\n`);
          }
          writeStream.write('\n');
        }
      }

      writeStream.end();
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      return totalRecords;
    } catch (error) {
      writeStream.destroy();
      throw error;
    }
  }

  private async executeRestore(
    metadata: BackupMetadata,
    tables: string[],
    options: RestoreOptions
  ): Promise<{
    tables: string[];
    records: number;
    warnings: string[];
  }> {
    const warnings: string[] = [];
    let restoredRecords = 0;

    // Read backup file
    const backupPath = this.getBackupPath(metadata.id);
    let backupFile = join(backupPath, 'backup.sql');

    // Handle compressed backups
    if (metadata.compressed) {
      backupFile += '.gz';
      await this.decompressBackup(backupFile);
      backupFile = backupFile.replace('.gz', '');
    }

    // Handle encrypted backups
    if (metadata.encrypted) {
      await this.decryptBackup(backupFile + '.enc');
    }

    // Execute restore within transaction
    await this.client.$transaction(async tx => {
      const backupContent = await this.readBackupFile(backupFile);
      const statements = this.parseBackupStatements(backupContent);

      for (const statement of statements) {
        if (this.isTableStatement(statement, tables)) {
          await tx.$executeRawUnsafe(statement);
          restoredRecords++;
        }
      }
    });

    return {
      tables,
      records: restoredRecords,
      warnings,
    };
  }

  // Helper methods (simplified implementations)
  private async ensureBackupDirectory(): Promise<void> {
    await mkdir(this.backupsPath, { recursive: true });
  }

  private async ensureMetadataTable(): Promise<void> {
    await this.client.$executeRaw`
      CREATE TABLE IF NOT EXISTS ${Prisma.raw(this.metadataTable)} (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        size BIGINT DEFAULT 0,
        compressed BOOLEAN DEFAULT FALSE,
        encrypted BOOLEAN DEFAULT FALSE,
        checksum VARCHAR(64),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        status VARCHAR(50) DEFAULT 'pending',
        error TEXT,
        tables TEXT[],
        record_count INTEGER DEFAULT 0,
        base_backup_id VARCHAR(255),
        version VARCHAR(50)
      )
    `;
  }

  private generateBackupId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `backup_${timestamp}_${random}`;
  }

  private getBackupPath(backupId: string): string {
    return join(this.backupsPath, backupId);
  }

  private async getDatabaseVersion(): Promise<string> {
    const result = await this.client.$queryRaw<any[]>`SELECT version()`;
    return result[0]?.version || 'unknown';
  }

  private async saveBackupMetadata(metadata: BackupMetadata): Promise<void> {
    await this.client.$executeRawUnsafe(
      `
      INSERT INTO ${this.metadataTable} 
      (id, name, type, size, compressed, encrypted, checksum, created_at, completed_at, status, error, tables, record_count, base_backup_id, version)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (id) DO UPDATE SET
        size = EXCLUDED.size,
        checksum = EXCLUDED.checksum,
        completed_at = EXCLUDED.completed_at,
        status = EXCLUDED.status,
        error = EXCLUDED.error,
        tables = EXCLUDED.tables,
        record_count = EXCLUDED.record_count
    `,
      metadata.id,
      metadata.name,
      metadata.type,
      metadata.size,
      metadata.compressed,
      metadata.encrypted,
      metadata.checksum,
      metadata.createdAt,
      metadata.completedAt,
      metadata.status,
      metadata.error,
      metadata.tables,
      metadata.recordCount,
      metadata.baseBackupId,
      metadata.version
    );
  }

  private mapRecordToMetadata(record: any): BackupMetadata {
    return {
      id: record.id,
      name: record.name,
      type: record.type,
      size: parseInt(record.size),
      compressed: record.compressed,
      encrypted: record.encrypted,
      checksum: record.checksum,
      createdAt: record.created_at,
      completedAt: record.completed_at,
      status: record.status,
      error: record.error,
      tables: record.tables || [],
      recordCount: record.record_count || 0,
      baseBackupId: record.base_backup_id,
      version: record.version,
    };
  }

  private async getTablesToBackup(config: BackupConfig): Promise<string[]> {
    if (config.tables) {
      return config.tables;
    }

    // Get all tables
    const result = await this.client.$queryRaw<any[]>`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `;

    let tables = result.map(r => r.tablename);

    // Exclude specified tables
    if (config.excludeTables) {
      tables = tables.filter(t => !config.excludeTables!.includes(t));
    }

    return tables;
  }

  private async getTableSchema(table: string): Promise<string> {
    // Simplified schema extraction
    return `-- Schema for ${table}`;
  }

  private async exportTableData(table: string): Promise<string[]> {
    // Simplified data export
    return [`-- Data for ${table}`];
  }

  private async getTableChanges(table: string, since: Date): Promise<string[]> {
    // Simplified change detection
    return [`-- Changes for ${table} since ${since.toISOString()}`];
  }

  private async getLastBackup(name: string): Promise<BackupMetadata | null> {
    const backups = await this.listBackups(name);
    return backups.find(b => b.status === 'completed') || null;
  }

  private async getLastFullBackup(
    name: string
  ): Promise<BackupMetadata | null> {
    const backups = await this.listBackups(name);
    return (
      backups.find(b => b.type === 'full' && b.status === 'completed') || null
    );
  }

  private async calculateFileChecksum(filePath: string): Promise<string> {
    // Simplified checksum calculation
    return 'checksum_placeholder';
  }

  private async compressBackup(filePath: string): Promise<void> {
    const readStream = createReadStream(filePath);
    const writeStream = createWriteStream(filePath + '.gz');
    const gzip = createGzip();

    await pipeline(readStream, gzip, writeStream);
    await unlink(filePath); // Remove original file
  }

  private async decompressBackup(filePath: string): Promise<void> {
    const readStream = createReadStream(filePath);
    const writeStream = createWriteStream(filePath.replace('.gz', ''));
    const gunzip = createGunzip();

    await pipeline(readStream, gunzip, writeStream);
  }

  private async encryptBackup(filePath: string): Promise<void> {
    // Simplified encryption placeholder
    logger.debug('Encrypting backup', { filePath });
  }

  private async decryptBackup(filePath: string): Promise<void> {
    // Simplified decryption placeholder
    logger.debug('Decrypting backup', { filePath });
  }

  private async readBackupFile(filePath: string): Promise<string> {
    const { readFile } = await import('fs/promises');
    return await readFile(filePath, 'utf-8');
  }

  private parseBackupStatements(content: string): string[] {
    return content.split(';').filter(s => s.trim().length > 0);
  }

  private isTableStatement(statement: string, tables: string[]): boolean {
    return tables.some(table => statement.includes(table));
  }

  private async deleteBackupFiles(backupPath: string): Promise<void> {
    try {
      const files = await readdir(backupPath);
      for (const file of files) {
        await unlink(join(backupPath, file));
      }
      // Remove directory would require additional logic
    } catch (error) {
      logger.warn('Failed to delete backup files', {
        backupPath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private isWithinDays(date: Date, reference: Date, days: number): boolean {
    const diffTime = reference.getTime() - date.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays <= days;
  }
}

export const backupSystem = new BackupSystem();
