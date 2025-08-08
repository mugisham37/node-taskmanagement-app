import { db, pool } from '../connection';
import { sql } from 'drizzle-orm';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

export interface Migration {
  id: string;
  name: string;
  up: string;
  down: string;
  timestamp: Date;
}

export interface MigrationRecord {
  id: string;
  name: string;
  executed_at: Date;
  checksum: string;
}

export class MigrationRunner {
  private migrationsPath: string;

  constructor(migrationsPath: string = __dirname) {
    this.migrationsPath = migrationsPath;
  }

  async ensureMigrationsTable(): Promise<void> {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP NOT NULL DEFAULT NOW(),
        checksum VARCHAR(64) NOT NULL
      )
    `);
  }

  async getExecutedMigrations(): Promise<MigrationRecord[]> {
    try {
      const result = await db.execute(sql`
        SELECT id, name, executed_at, checksum 
        FROM migrations 
        ORDER BY executed_at ASC
      `);
      
      const rows = result.rows || result;
      return (rows as any[]).map(row => ({
        id: row.id,
        name: row.name,
        executed_at: new Date(row.executed_at),
        checksum: row.checksum
      }));
    } catch (error) {
      console.error('Error getting executed migrations:', error);
      return [];
    }
  }

  async getPendingMigrations(): Promise<Migration[]> {
    const allMigrations = await this.loadMigrations();
    const executedMigrations = await this.getExecutedMigrations();
    const executedIds = new Set(executedMigrations.map(m => m.id));

    return allMigrations.filter(migration => !executedIds.has(migration.id));
  }

  async loadMigrations(): Promise<Migration[]> {
    try {
      const files = await readdir(this.migrationsPath);
      const migrationFiles = files
        .filter(file => file.endsWith('.sql') && file.includes('_'))
        .sort();

      const migrations: Migration[] = [];

      for (const file of migrationFiles) {
        const filePath = join(this.migrationsPath, file);
        const content = await readFile(filePath, 'utf-8');
        
        // Parse migration file
        const parts = content.split('-- DOWN');
        if (parts.length !== 2) {
          console.warn(`Invalid migration file format: ${file}`);
          continue;
        }

        const upPart = parts[0].replace('-- UP', '').trim();
        const downPart = parts[1].trim();

        // Extract timestamp and name from filename
        const match = file.match(/^(\d{14})_(.+)\.sql$/);
        if (!match) {
          console.warn(`Invalid migration filename format: ${file}`);
          continue;
        }

        const [, timestamp, name] = match;
        const id = `${timestamp}_${name}`;

        migrations.push({
          id,
          name: name.replace(/_/g, ' '),
          up: upPart,
          down: downPart,
          timestamp: this.parseTimestamp(timestamp)
        });
      }

      return migrations;
    } catch (error) {
      console.error('Error loading migrations:', error);
      return [];
    }
  }

  private parseTimestamp(timestamp: string): Date {
    // Format: YYYYMMDDHHMMSS
    const year = parseInt(timestamp.substr(0, 4));
    const month = parseInt(timestamp.substr(4, 2)) - 1; // Month is 0-indexed
    const day = parseInt(timestamp.substr(6, 2));
    const hour = parseInt(timestamp.substr(8, 2));
    const minute = parseInt(timestamp.substr(10, 2));
    const second = parseInt(timestamp.substr(12, 2));

    return new Date(year, month, day, hour, minute, second);
  }

  private generateChecksum(content: string): string {
    // Simple checksum using built-in crypto
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex').substr(0, 16);
  }

  async runMigrations(): Promise<{ success: boolean; executed: string[]; errors: string[] }> {
    const result = {
      success: true,
      executed: [] as string[],
      errors: [] as string[]
    };

    try {
      await this.ensureMigrationsTable();
      const pendingMigrations = await this.getPendingMigrations();

      if (pendingMigrations.length === 0) {
        console.log('No pending migrations to run');
        return result;
      }

      console.log(`Running ${pendingMigrations.length} pending migrations...`);

      for (const migration of pendingMigrations) {
        try {
          console.log(`Running migration: ${migration.id}`);
          
          // Execute migration in a transaction
          await db.transaction(async (tx) => {
            // Execute the migration SQL
            await tx.execute(sql.raw(migration.up));
            
            // Record the migration
            const checksum = this.generateChecksum(migration.up);
            await tx.execute(sql`
              INSERT INTO migrations (id, name, executed_at, checksum)
              VALUES (${migration.id}, ${migration.name}, NOW(), ${checksum})
            `);
          });

          result.executed.push(migration.id);
          console.log(`✅ Migration completed: ${migration.id}`);
        } catch (error) {
          const errorMsg = `Failed to run migration ${migration.id}: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMsg);
          result.success = false;
          console.error(`❌ ${errorMsg}`);
          break; // Stop on first error
        }
      }
    } catch (error) {
      result.success = false;
      result.errors.push(`Migration runner error: ${error instanceof Error ? error.message : String(error)}`);
      console.error('❌ Migration runner error:', error);
    }

    return result;
  }

  async rollbackMigration(migrationId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const allMigrations = await this.loadMigrations();
      const migration = allMigrations.find(m => m.id === migrationId);

      if (!migration) {
        return { success: false, error: `Migration not found: ${migrationId}` };
      }

      const executedMigrations = await this.getExecutedMigrations();
      const isExecuted = executedMigrations.some(m => m.id === migrationId);

      if (!isExecuted) {
        return { success: false, error: `Migration not executed: ${migrationId}` };
      }

      console.log(`Rolling back migration: ${migrationId}`);

      await db.transaction(async (tx) => {
        // Execute rollback SQL
        await tx.execute(sql.raw(migration.down));
        
        // Remove migration record
        await tx.execute(sql`
          DELETE FROM migrations WHERE id = ${migrationId}
        `);
      });

      console.log(`✅ Migration rolled back: ${migrationId}`);
      return { success: true };
    } catch (error) {
      const errorMsg = `Failed to rollback migration ${migrationId}: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }

  async getMigrationStatus(): Promise<{
    executed: MigrationRecord[];
    pending: Migration[];
    total: number;
  }> {
    const [executed, pending] = await Promise.all([
      this.getExecutedMigrations(),
      this.getPendingMigrations()
    ]);

    return {
      executed,
      pending,
      total: executed.length + pending.length
    };
  }

  async validateMigrations(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    try {
      const allMigrations = await this.loadMigrations();
      const executedMigrations = await this.getExecutedMigrations();

      // Check for checksum mismatches
      for (const executed of executedMigrations) {
        const migration = allMigrations.find(m => m.id === executed.id);
        if (migration) {
          const currentChecksum = this.generateChecksum(migration.up);
          if (currentChecksum !== executed.checksum) {
            issues.push(`Checksum mismatch for migration ${executed.id}`);
          }
        } else {
          issues.push(`Executed migration ${executed.id} not found in migration files`);
        }
      }

      // Check for duplicate migration IDs
      const ids = allMigrations.map(m => m.id);
      const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
      if (duplicates.length > 0) {
        issues.push(`Duplicate migration IDs: ${duplicates.join(', ')}`);
      }

    } catch (error) {
      issues.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}

// Export singleton instance
export const migrationRunner = new MigrationRunner();

// CLI-friendly functions
export async function runMigrations(): Promise<void> {
  const result = await migrationRunner.runMigrations();
  
  if (result.success) {
    console.log(`✅ Successfully executed ${result.executed.length} migrations`);
  } else {
    console.error('❌ Migration failed');
    result.errors.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
  }
}

export async function showMigrationStatus(): Promise<void> {
  const status = await migrationRunner.getMigrationStatus();
  
  console.log('\n📊 Migration Status:');
  console.log(`  Total migrations: ${status.total}`);
  console.log(`  Executed: ${status.executed.length}`);
  console.log(`  Pending: ${status.pending.length}`);
  
  if (status.pending.length > 0) {
    console.log('\n⏳ Pending migrations:');
    status.pending.forEach(migration => {
      console.log(`  - ${migration.id}: ${migration.name}`);
    });
  }
  
  if (status.executed.length > 0) {
    console.log('\n✅ Executed migrations:');
    status.executed.forEach(migration => {
      console.log(`  - ${migration.id}: ${migration.name} (${migration.executed_at.toISOString()})`);
    });
  }
}

export async function validateMigrations(): Promise<void> {
  const validation = await migrationRunner.validateMigrations();
  
  if (validation.valid) {
    console.log('✅ All migrations are valid');
  } else {
    console.error('❌ Migration validation failed:');
    validation.issues.forEach(issue => console.error(`  - ${issue}`));
    process.exit(1);
  }
}
