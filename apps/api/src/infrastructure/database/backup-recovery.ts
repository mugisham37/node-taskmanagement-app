import { DatabaseConnection } from './connection';
import { PoolClient } from 'pg';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface BackupOptions {
  outputPath: string;
  includeData?: boolean;
  includeSchema?: boolean;
  tables?: string[];
  compress?: boolean;
  format?: 'sql' | 'json';
}

export interface RestoreOptions {
  backupPath: string;
  dropExisting?: boolean;
  skipErrors?: boolean;
  tables?: string[];
}

export interface BackupMetadata {
  timestamp: Date;
  version: string;
  tables: string[];
  recordCounts: Record<string, number>;
  size: number;
  format: string;
}

export class BackupRecoveryManager {
  private connection: DatabaseConnection;

  constructor(connection: DatabaseConnection) {
    this.connection = connection;
  }

  /**
   * Create a full database backup
   */
  async createBackup(options: BackupOptions): Promise<BackupMetadata> {
    const {
      outputPath,
      includeData = true,
      includeSchema = true,
      tables,
      compress = false,
      format = 'sql',
    } = options;

    console.log('Starting database backup...');

    const client = await this.connection.pool.connect();

    try {
      // Get list of tables to backup
      const tablesToBackup = tables || (await this.getAllTables(client));

      // Create backup metadata
      const metadata: BackupMetadata = {
        timestamp: new Date(),
        version: await this.getDatabaseVersion(client),
        tables: tablesToBackup,
        recordCounts: {},
        size: 0,
        format,
      };

      // Get record counts
      for (const table of tablesToBackup) {
        const countResult = await client.query(`SELECT COUNT(*) FROM ${table}`);
        metadata.recordCounts[table] = parseInt(countResult.rows[0].count);
      }

      let backupContent = '';

      if (format === 'sql') {
        backupContent = await this.createSQLBackup(
          client,
          tablesToBackup,
          includeSchema,
          includeData
        );
      } else {
        backupContent = await this.createJSONBackup(
          client,
          tablesToBackup,
          includeData
        );
      }

      // Write backup to file
      await fs.writeFile(outputPath, backupContent, 'utf8');

      // Get file size
      const stats = await fs.stat(outputPath);
      metadata.size = stats.size;

      // Write metadata file
      const metadataPath = outputPath.replace(/\.[^.]+$/, '.metadata.json');
      await fs.writeFile(
        metadataPath,
        JSON.stringify(metadata, null, 2),
        'utf8'
      );

      console.log(`Backup completed: ${outputPath}`);
      console.log(`Tables backed up: ${tablesToBackup.length}`);
      console.log(
        `Total records: ${Object.values(metadata.recordCounts).reduce((sum, count) => sum + count, 0)}`
      );
      console.log(`Backup size: ${this.formatBytes(metadata.size)}`);

      return metadata;
    } finally {
      client.release();
    }
  }

  /**
   * Restore database from backup
   */
  async restoreFromBackup(options: RestoreOptions): Promise<void> {
    const {
      backupPath,
      dropExisting = false,
      skipErrors = false,
      tables,
    } = options;

    console.log('Starting database restore...');

    // Read backup file
    const backupContent = await fs.readFile(backupPath, 'utf8');

    // Try to read metadata
    let metadata: BackupMetadata | null = null;
    const metadataPath = backupPath.replace(/\.[^.]+$/, '.metadata.json');

    try {
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      metadata = JSON.parse(metadataContent);
    } catch (error) {
      console.warn('Could not read backup metadata');
    }

    const client = await this.connection.pool.connect();

    try {
      // Drop existing tables if requested
      if (dropExisting && metadata) {
        await this.dropTables(client, metadata.tables);
      }

      if (metadata?.format === 'json') {
        await this.restoreFromJSON(client, backupContent, tables, skipErrors);
      } else {
        await this.restoreFromSQL(client, backupContent, skipErrors);
      }

      console.log('Database restore completed successfully');
    } finally {
      client.release();
    }
  }

  /**
   * Create incremental backup (only changed data since last backup)
   */
  async createIncrementalBackup(
    options: BackupOptions,
    lastBackupTimestamp: Date
  ): Promise<BackupMetadata> {
    console.log('Creating incremental backup...');

    const client = await this.connection.pool.connect();

    try {
      const tablesToBackup =
        options.tables || (await this.getAllTables(client));
      const changedData: Record<string, any[]> = {};

      // Find changed records for each table
      for (const table of tablesToBackup) {
        const hasUpdatedAt = await this.tableHasColumn(
          client,
          table,
          'updated_at'
        );

        if (hasUpdatedAt) {
          const query = `
            SELECT * FROM ${table} 
            WHERE updated_at > $1 OR created_at > $1
            ORDER BY updated_at DESC
          `;

          const result = await client.query(query, [lastBackupTimestamp]);

          if (result.rows.length > 0) {
            changedData[table] = result.rows;
          }
        }
      }

      // Create backup content
      const backupContent = JSON.stringify(
        {
          type: 'incremental',
          baseTimestamp: lastBackupTimestamp,
          timestamp: new Date(),
          data: changedData,
        },
        null,
        2
      );

      // Write backup
      await fs.writeFile(options.outputPath, backupContent, 'utf8');

      const metadata: BackupMetadata = {
        timestamp: new Date(),
        version: await this.getDatabaseVersion(client),
        tables: Object.keys(changedData),
        recordCounts: Object.fromEntries(
          Object.entries(changedData).map(([table, rows]) => [
            table,
            rows.length,
          ])
        ),
        size: Buffer.byteLength(backupContent, 'utf8'),
        format: 'json',
      };

      console.log(`Incremental backup completed: ${options.outputPath}`);
      console.log(`Changed tables: ${Object.keys(changedData).length}`);
      console.log(
        `Total changed records: ${Object.values(changedData).reduce((sum, rows) => sum + rows.length, 0)}`
      );

      return metadata;
    } finally {
      client.release();
    }
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupPath: string): Promise<{
    isValid: boolean;
    errors: string[];
    metadata?: BackupMetadata;
  }> {
    const errors: string[] = [];

    try {
      // Check if backup file exists
      await fs.access(backupPath);

      // Read backup content
      const backupContent = await fs.readFile(backupPath, 'utf8');

      // Try to read metadata
      let metadata: BackupMetadata | null = null;
      const metadataPath = backupPath.replace(/\.[^.]+$/, '.metadata.json');

      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf8');
        metadata = JSON.parse(metadataContent);
      } catch (error) {
        errors.push('Metadata file not found or invalid');
      }

      // Validate backup content
      if (metadata?.format === 'json') {
        try {
          JSON.parse(backupContent);
        } catch (error) {
          errors.push('Invalid JSON format in backup file');
        }
      } else {
        // Basic SQL validation
        if (
          !backupContent.includes('CREATE TABLE') &&
          !backupContent.includes('INSERT INTO')
        ) {
          errors.push('Backup file appears to be empty or invalid');
        }
      }

      // Check file size matches metadata
      if (metadata) {
        const stats = await fs.stat(backupPath);
        if (Math.abs(stats.size - metadata.size) > 1024) {
          // Allow 1KB difference
          errors.push('File size does not match metadata');
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        metadata: metadata || undefined,
      };
    } catch (error) {
      errors.push(`Failed to access backup file: ${error}`);
      return { isValid: false, errors };
    }
  }

  private async createSQLBackup(
    client: PoolClient,
    tables: string[],
    includeSchema: boolean,
    includeData: boolean
  ): Promise<string> {
    let sql = '';

    // Add header
    sql += `-- Database Backup\n`;
    sql += `-- Generated on: ${new Date().toISOString()}\n`;
    sql += `-- Tables: ${tables.join(', ')}\n\n`;

    for (const table of tables) {
      if (includeSchema) {
        // Get table schema
        const schemaQuery = `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_name = $1
          ORDER BY ordinal_position
        `;

        const schemaResult = await client.query(schemaQuery, [table]);

        sql += `-- Table: ${table}\n`;
        sql += `DROP TABLE IF EXISTS ${table} CASCADE;\n`;
        sql += `CREATE TABLE ${table} (\n`;

        const columns = schemaResult.rows.map(row => {
          let columnDef = `  ${row.column_name} ${row.data_type}`;
          if (row.is_nullable === 'NO') columnDef += ' NOT NULL';
          if (row.column_default) columnDef += ` DEFAULT ${row.column_default}`;
          return columnDef;
        });

        sql += columns.join(',\n');
        sql += '\n);\n\n';
      }

      if (includeData) {
        // Get table data
        const dataResult = await client.query(`SELECT * FROM ${table}`);

        if (dataResult.rows.length > 0) {
          const columns = Object.keys(dataResult.rows[0]);
          sql += `-- Data for table: ${table}\n`;

          for (const row of dataResult.rows) {
            const values = columns.map(col => {
              const value = row[col];
              if (value === null) return 'NULL';
              if (typeof value === 'string')
                return `'${value.replace(/'/g, "''")}'`;
              if (value instanceof Date) return `'${value.toISOString()}'`;
              return value;
            });

            sql += `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
          }

          sql += '\n';
        }
      }
    }

    return sql;
  }

  private async createJSONBackup(
    client: PoolClient,
    tables: string[],
    includeData: boolean
  ): Promise<string> {
    const backup: Record<string, any> = {
      timestamp: new Date().toISOString(),
      tables: {},
    };

    for (const table of tables) {
      backup.tables[table] = {
        schema: await this.getTableSchema(client, table),
        data: includeData ? await this.getTableData(client, table) : [],
      };
    }

    return JSON.stringify(backup, null, 2);
  }

  private async restoreFromSQL(
    client: PoolClient,
    sqlContent: string,
    skipErrors: boolean
  ): Promise<void> {
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (const statement of statements) {
      try {
        await client.query(statement);
      } catch (error) {
        if (skipErrors) {
          console.warn(`Skipped statement due to error: ${error}`);
        } else {
          throw error;
        }
      }
    }
  }

  private async restoreFromJSON(
    client: PoolClient,
    jsonContent: string,
    tables?: string[],
    skipErrors?: boolean
  ): Promise<void> {
    const backup = JSON.parse(jsonContent);
    const tablesToRestore = tables || Object.keys(backup.tables);

    for (const table of tablesToRestore) {
      if (!backup.tables[table]) continue;

      try {
        const tableData = backup.tables[table];

        // Restore data
        if (tableData.data && tableData.data.length > 0) {
          const columns = Object.keys(tableData.data[0]);

          for (const row of tableData.data) {
            const values = columns.map(col => row[col]);
            const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

            await client.query(
              `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
              values
            );
          }
        }
      } catch (error) {
        if (skipErrors) {
          console.warn(`Skipped table ${table} due to error: ${error}`);
        } else {
          throw error;
        }
      }
    }
  }

  private async getAllTables(client: PoolClient): Promise<string[]> {
    const result = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    return result.rows.map(row => row.tablename);
  }

  private async getDatabaseVersion(client: PoolClient): Promise<string> {
    const result = await client.query('SELECT version()');
    return result.rows[0].version;
  }

  private async getTableSchema(
    client: PoolClient,
    table: string
  ): Promise<any[]> {
    const result = await client.query(
      `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `,
      [table]
    );

    return result.rows;
  }

  private async getTableData(
    client: PoolClient,
    table: string
  ): Promise<any[]> {
    const result = await client.query(`SELECT * FROM ${table}`);
    return result.rows;
  }

  private async dropTables(
    client: PoolClient,
    tables: string[]
  ): Promise<void> {
    for (const table of tables.reverse()) {
      // Reverse to handle dependencies
      try {
        await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
      } catch (error) {
        console.warn(`Failed to drop table ${table}: ${error}`);
      }
    }
  }

  private async tableHasColumn(
    client: PoolClient,
    table: string,
    column: string
  ): Promise<boolean> {
    const result = await client.query(
      `
      SELECT 1 FROM information_schema.columns
      WHERE table_name = $1 AND column_name = $2
    `,
      [table, column]
    );

    return result.rows.length > 0;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Factory function
export function createBackupRecoveryManager(
  connection: DatabaseConnection
): BackupRecoveryManager {
  return new BackupRecoveryManager(connection);
}
