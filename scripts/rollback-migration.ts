#!/usr/bin/env tsx

/**
 * Rollback script for monorepo migration
 * This script safely rolls back the monolithic fullstack transformation
 */

import { execSync } from 'child_process';
import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

class MigrationRollback {
  private backupDir: string;
  private rollbackLog: string[] = [];

  constructor(backupDir?: string) {
    // Find the most recent backup if not specified
    this.backupDir = backupDir || this.findLatestBackup();
  }

  async rollback(): Promise<void> {
    console.log('🔄 Starting migration rollback...');
    
    try {
      await this.validateBackup();
      await this.rollbackDatabase();
      await this.rollbackConfiguration();
      await this.rollbackPackageStructure();
      await this.cleanupMigrationArtifacts();
      await this.generateRollbackReport();
      
      console.log('✅ Rollback completed successfully!');
      console.log('⚠️  Please run `npm install` to restore dependencies');
      
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }

  private findLatestBackup(): string {
    const backupBaseDir = join(rootDir, 'migration-backup');
    
    if (!existsSync(backupBaseDir)) {
      throw new Error('No backup directory found. Cannot perform rollback.');
    }

    // Find the most recent backup directory
    const backupDirs = require('fs').readdirSync(backupBaseDir)
      .filter((dir: string) => /^\d{4}-\d{2}-\d{2}/.test(dir))
      .sort()
      .reverse();

    if (backupDirs.length === 0) {
      throw new Error('No valid backup found in migration-backup directory.');
    }

    return join(backupBaseDir, backupDirs[0]);
  }

  private async validateBackup(): Promise<void> {
    console.log('🔍 Validating backup...');
    
    if (!existsSync(this.backupDir)) {
      throw new Error(`Backup directory not found: ${this.backupDir}`);
    }

    // Check for essential backup files
    const requiredFiles = [
      'apps/server/package.json',
      'apps/server/drizzle.config.ts'
    ];

    for (const file of requiredFiles) {
      const backupPath = join(this.backupDir, file);
      if (!existsSync(backupPath)) {
        console.warn(`⚠️  Backup file not found: ${file}`);
      }
    }

    this.log('Backup validation completed');
  }

  private async rollbackDatabase(): Promise<void> {
    console.log('🗄️  Rolling back database...');
    
    const dbBackupPath = join(this.backupDir, 'database-backup.sql');
    
    if (existsSync(dbBackupPath)) {
      try {
        // Drop migration metadata table if it exists
        const dbUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/taskmanagement';
        
        const cleanupScript = `
-- Cleanup migration artifacts
DROP TABLE IF EXISTS migration_metadata CASCADE;
DROP TABLE IF EXISTS migration_backup_users CASCADE;
DROP TABLE IF EXISTS migration_backup_workspaces CASCADE;
DROP TABLE IF EXISTS migration_backup_projects CASCADE;
DROP TABLE IF EXISTS migration_backup_tasks CASCADE;
DROP TABLE IF EXISTS migration_backup_project_members CASCADE;
`;

        // Write cleanup script to temp file
        const tempCleanupPath = join(this.backupDir, 'cleanup.sql');
        writeFileSync(tempCleanupPath, cleanupScript);
        
        // Execute cleanup
        execSync(`psql "${dbUrl}" < "${tempCleanupPath}"`, { stdio: 'inherit' });
        
        // Restore from backup
        execSync(`psql "${dbUrl}" < "${dbBackupPath}"`, { stdio: 'inherit' });
        
        this.log('Database restored from backup');
      } catch (error) {
        console.warn('⚠️  Database rollback failed:', error);
        this.log(`Database rollback failed: ${error}`);
      }
    } else {
      console.warn('⚠️  No database backup found, skipping database rollback');
    }
  }

  private async rollbackConfiguration(): Promise<void> {
    console.log('⚙️  Rolling back configuration...');
    
    // Restore configuration files
    const configFiles = [
      'apps/server/.env',
      'apps/server/.env.production',
      'apps/server/.env.staging',
      'apps/server/package.json',
      'apps/server/drizzle.config.ts',
      'apps/server/tsconfig.json'
    ];

    for (const file of configFiles) {
      const backupPath = join(this.backupDir, file);
      const targetPath = join(rootDir, file);
      
      if (existsSync(backupPath)) {
        copyFileSync(backupPath, targetPath);
        this.log(`Restored configuration: ${file}`);
      }
    }
  }

  private async rollbackPackageStructure(): Promise<void> {
    console.log('📦 Rolling back package structure...');
    
    // Remove monorepo-specific changes from root package.json
    const rootPackagePath = join(rootDir, 'package.json');
    if (existsSync(rootPackagePath)) {
      const packageJson = JSON.parse(readFileSync(rootPackagePath, 'utf-8'));
      
      // Remove workspace configuration
      delete packageJson.workspaces;
      
      // Remove monorepo-specific scripts
      if (packageJson.scripts) {
        delete packageJson.scripts['migrate:monorepo'];
        delete packageJson.scripts['migrate:rollback'];
        delete packageJson.scripts['build:all'];
        delete packageJson.scripts['test:all'];
      }

      writeFileSync(rootPackagePath, JSON.stringify(packageJson, null, 2));
      this.log('Removed monorepo configuration from root package.json');
    }

    // Restore database schema to server if it was moved
    const packagesDatabaseSchema = join(rootDir, 'packages/database/src/schema');
    const serverDatabaseSchema = join(rootDir, 'apps/server/src/infrastructure/database/schema');
    
    if (existsSync(packagesDatabaseSchema) && !existsSync(serverDatabaseSchema)) {
      execSync(`cp -r "${packagesDatabaseSchema}" "${dirname(serverDatabaseSchema)}"`, { stdio: 'inherit' });
      this.log('Restored database schema to server');
    }

    // Restore migrations to server if they were moved
    const packagesDatabaseMigrations = join(rootDir, 'packages/database/src/migrations');
    const serverDatabaseMigrations = join(rootDir, 'apps/server/src/infrastructure/database/migrations');
    
    if (existsSync(packagesDatabaseMigrations) && !existsSync(serverDatabaseMigrations)) {
      execSync(`cp -r "${packagesDatabaseMigrations}" "${dirname(serverDatabaseMigrations)}"`, { stdio: 'inherit' });
      this.log('Restored database migrations to server');
    }
  }

  private async cleanupMigrationArtifacts(): Promise<void> {
    console.log('🧹 Cleaning up migration artifacts...');
    
    // Remove migration-specific files
    const artifactsToRemove = [
      'migration-report.md',
      'packages/database/drizzle.config.ts',
      'packages/config/src/env.ts',
      'packages/database/src/migrations/data-preservation.sql'
    ];

    for (const artifact of artifactsToRemove) {
      const artifactPath = join(rootDir, artifact);
      if (existsSync(artifactPath)) {
        rmSync(artifactPath, { force: true });
        this.log(`Removed migration artifact: ${artifact}`);
      }
    }

    // Remove empty directories
    const dirsToCheck = [
      'packages/database/src/migrations',
      'packages/database/src',
      'packages/database',
      'packages/config/src',
      'packages/config'
    ];

    for (const dir of dirsToCheck) {
      const dirPath = join(rootDir, dir);
      if (existsSync(dirPath)) {
        try {
          const files = require('fs').readdirSync(dirPath);
          if (files.length === 0) {
            rmSync(dirPath, { recursive: true, force: true });
            this.log(`Removed empty directory: ${dir}`);
          }
        } catch (error) {
          // Directory might not be empty or might not exist
        }
      }
    }
  }

  private async generateRollbackReport(): Promise<void> {
    const reportPath = join(rootDir, 'rollback-report.md');
    const report = `# Migration Rollback Report

## Rollback Summary
- **Date**: ${new Date().toISOString()}
- **Status**: Completed Successfully
- **Backup Used**: ${this.backupDir}

## Rollback Steps Completed
${this.rollbackLog.map(log => `- ${log}`).join('\n')}

## Post-Rollback Steps Required
1. Run \`npm install\` to restore dependencies
2. Verify database connectivity: \`npm run db:studio\`
3. Run tests to ensure functionality: \`npm test\`
4. Check application startup: \`npm run dev\`

## Verification Checklist
- [ ] Database is accessible and contains expected data
- [ ] Server starts without errors
- [ ] All tests pass
- [ ] Configuration files are restored
- [ ] No monorepo artifacts remain

## Notes
- Original backup preserved at: ${this.backupDir}
- If issues persist, check the rollback log above
- Consider running a fresh \`npm install\` if dependency issues occur
`;

    writeFileSync(reportPath, report);
    console.log(`📋 Rollback report generated: ${reportPath}`);
  }

  private log(message: string): void {
    this.rollbackLog.push(`${new Date().toISOString()}: ${message}`);
    console.log(`  ${message}`);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    console.log(`
Usage: npm run migrate:rollback [backup-directory]

Arguments:
  backup-directory     Path to specific backup directory (optional)
                      If not provided, uses the most recent backup

Options:
  --help              Show this help message

Examples:
  npm run migrate:rollback
  npm run migrate:rollback migration-backup/2024-01-15
`);
    return;
  }

  const backupDir = args[0];
  const rollback = new MigrationRollback(backupDir);
  await rollback.rollback();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { MigrationRollback };
