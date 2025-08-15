#!/usr/bin/env tsx

/**
 * Migration script for transforming existing server data to monorepo structure
 * This script handles data preservation during the monolithic fullstack transformation
 */

import { execSync } from 'child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

interface MigrationConfig {
  sourceDir: string;
  targetDir: string;
  preserveData: boolean;
  createBackup: boolean;
  validateIntegrity: boolean;
}

class MonorepoMigrator {
  private config: MigrationConfig;
  private backupDir: string;
  private migrationLog: string[] = [];

  constructor(config: MigrationConfig) {
    this.config = config;
    this.backupDir = join(rootDir, 'migration-backup', new Date().toISOString().split('T')[0]);
  }

  async migrate(): Promise<void> {
    console.log('🚀 Starting monorepo migration...');
    
    try {
      if (this.config.createBackup) {
        await this.createBackup();
      }

      await this.validatePrerequisites();
      await this.migrateDatabase();
      await this.migrateEnvironmentConfig();
      await this.migrateApplicationData();
      await this.updatePackageReferences();
      
      if (this.config.validateIntegrity) {
        await this.validateMigration();
      }

      await this.generateMigrationReport();
      console.log('✅ Migration completed successfully!');
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      await this.rollback();
      throw error;
    }
  }

  private async createBackup(): Promise<void> {
    console.log('📦 Creating backup...');
    
    if (!existsSync(this.backupDir)) {
      mkdirSync(this.backupDir, { recursive: true });
    }

    // Backup database
    await this.backupDatabase();
    
    // Backup configuration files
    const configFiles = [
      'apps/server/.env',
      'apps/server/.env.production',
      'apps/server/.env.staging',
      'apps/server/package.json',
      'apps/server/drizzle.config.ts',
      'apps/server/tsconfig.json'
    ];

    for (const file of configFiles) {
      const sourcePath = join(rootDir, file);
      if (existsSync(sourcePath)) {
        const targetPath = join(this.backupDir, file);
        mkdirSync(dirname(targetPath), { recursive: true });
        copyFileSync(sourcePath, targetPath);
        this.log(`Backed up: ${file}`);
      }
    }
  }

  private async backupDatabase(): Promise<void> {
    console.log('💾 Creating database backup...');
    
    const dbUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/taskmanagement';
    const backupFile = join(this.backupDir, 'database-backup.sql');
    
    try {
      execSync(`pg_dump "${dbUrl}" > "${backupFile}"`, { stdio: 'inherit' });
      this.log('Database backup created successfully');
    } catch (error) {
      console.warn('⚠️  Database backup failed, continuing without backup');
      this.log(`Database backup failed: ${error}`);
    }
  }

  private async validatePrerequisites(): Promise<void> {
    console.log('🔍 Validating prerequisites...');
    
    // Check if packages directory exists
    const packagesDir = join(rootDir, 'packages');
    if (!existsSync(packagesDir)) {
      throw new Error('Packages directory not found. Please ensure monorepo structure is set up.');
    }

    // Check required packages
    const requiredPackages = ['shared', 'database', 'ui', 'config'];
    for (const pkg of requiredPackages) {
      const pkgPath = join(packagesDir, pkg);
      if (!existsSync(pkgPath)) {
        throw new Error(`Required package not found: ${pkg}`);
      }
    }

    // Check database connectivity
    try {
      execSync('npm run db:studio --dry-run', { cwd: join(rootDir, 'apps/server'), stdio: 'pipe' });
      this.log('Database connectivity verified');
    } catch (error) {
      console.warn('⚠️  Could not verify database connectivity');
    }
  }

  private async migrateDatabase(): Promise<void> {
    console.log('🗄️  Migrating database schema...');
    
    // Move database schema to packages/database
    const sourceSchemaDir = join(rootDir, 'apps/server/src/infrastructure/database/schema');
    const targetSchemaDir = join(rootDir, 'packages/database/src/schema');
    
    if (existsSync(sourceSchemaDir) && !existsSync(targetSchemaDir)) {
      mkdirSync(dirname(targetSchemaDir), { recursive: true });
      execSync(`cp -r "${sourceSchemaDir}" "${dirname(targetSchemaDir)}"`, { stdio: 'inherit' });
      this.log('Database schema migrated to packages/database');
    }

    // Move migrations
    const sourceMigrationsDir = join(rootDir, 'apps/server/src/infrastructure/database/migrations');
    const targetMigrationsDir = join(rootDir, 'packages/database/src/migrations');
    
    if (existsSync(sourceMigrationsDir) && !existsSync(targetMigrationsDir)) {
      mkdirSync(dirname(targetMigrationsDir), { recursive: true });
      execSync(`cp -r "${sourceMigrationsDir}" "${dirname(targetMigrationsDir)}"`, { stdio: 'inherit' });
      this.log('Database migrations migrated to packages/database');
    }

    // Update drizzle config for packages/database
    const drizzleConfig = `import type { Config } from 'drizzle-kit';
import { config } from 'dotenv';

config();

export default {
  schema: './src/schema/*',
  out: './src/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString:
      process.env.DATABASE_URL || 'postgresql://localhost:5432/taskmanagement',
  },
  verbose: true,
  strict: true,
} satisfies Config;
`;

    writeFileSync(join(rootDir, 'packages/database/drizzle.config.ts'), drizzleConfig);
    this.log('Updated drizzle config for packages/database');
  }

  private async migrateEnvironmentConfig(): Promise<void> {
    console.log('⚙️  Migrating environment configuration...');
    
    // Create shared environment configuration
    const serverEnvPath = join(rootDir, 'apps/server/.env');
    const sharedConfigPath = join(rootDir, 'packages/config/src/env.ts');
    
    if (existsSync(serverEnvPath)) {
      const envContent = readFileSync(serverEnvPath, 'utf-8');
      const envConfig = this.parseEnvFile(envContent);
      
      const configContent = `// Auto-generated environment configuration
export const env = {
  DATABASE_URL: process.env.DATABASE_URL || '${envConfig.DATABASE_URL || 'postgresql://localhost:5432/taskmanagement'}',
  REDIS_URL: process.env.REDIS_URL || '${envConfig.REDIS_URL || 'redis://localhost:6379'}',
  JWT_SECRET: process.env.JWT_SECRET || '${envConfig.JWT_SECRET || 'your-jwt-secret'}',
  PORT: parseInt(process.env.PORT || '${envConfig.PORT || '3001'}'),
  NODE_ENV: process.env.NODE_ENV || '${envConfig.NODE_ENV || 'development'}',
  // Add other environment variables as needed
} as const;

export type Env = typeof env;
`;

      mkdirSync(dirname(sharedConfigPath), { recursive: true });
      writeFileSync(sharedConfigPath, configContent);
      this.log('Environment configuration migrated to packages/config');
    }
  }

  private parseEnvFile(content: string): Record<string, string> {
    const env: Record<string, string> = {};
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        }
      }
    }
    
    return env;
  }

  private async migrateApplicationData(): Promise<void> {
    console.log('📊 Migrating application data...');
    
    // Create data migration scripts for preserving existing data
    const migrationScript = `-- Data preservation migration for monorepo transformation
-- This script ensures all existing data is preserved during the migration

-- Create backup tables for critical data
CREATE TABLE IF NOT EXISTS migration_backup_users AS SELECT * FROM users;
CREATE TABLE IF NOT EXISTS migration_backup_workspaces AS SELECT * FROM workspaces;
CREATE TABLE IF NOT EXISTS migration_backup_projects AS SELECT * FROM projects;
CREATE TABLE IF NOT EXISTS migration_backup_tasks AS SELECT * FROM tasks;
CREATE TABLE IF NOT EXISTS migration_backup_project_members AS SELECT * FROM project_members;

-- Verify data integrity
DO $$
DECLARE
    user_count INTEGER;
    workspace_count INTEGER;
    project_count INTEGER;
    task_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users;
    SELECT COUNT(*) INTO workspace_count FROM workspaces;
    SELECT COUNT(*) INTO project_count FROM projects;
    SELECT COUNT(*) INTO task_count FROM tasks;
    
    RAISE NOTICE 'Data integrity check:';
    RAISE NOTICE 'Users: %', user_count;
    RAISE NOTICE 'Workspaces: %', workspace_count;
    RAISE NOTICE 'Projects: %', project_count;
    RAISE NOTICE 'Tasks: %', task_count;
    
    -- Ensure referential integrity
    IF EXISTS (SELECT 1 FROM tasks t LEFT JOIN projects p ON t.project_id = p.id WHERE p.id IS NULL) THEN
        RAISE EXCEPTION 'Referential integrity violation: tasks with invalid project_id';
    END IF;
    
    IF EXISTS (SELECT 1 FROM projects p LEFT JOIN workspaces w ON p.workspace_id = w.id WHERE w.id IS NULL) THEN
        RAISE EXCEPTION 'Referential integrity violation: projects with invalid workspace_id';
    END IF;
END $$;

-- Create migration metadata table
CREATE TABLE IF NOT EXISTS migration_metadata (
    id SERIAL PRIMARY KEY,
    migration_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

INSERT INTO migration_metadata (migration_type, status, metadata) 
VALUES ('monorepo_transformation', 'in_progress', '{"version": "1.0.0", "backup_created": true}');
`;

    const migrationPath = join(rootDir, 'packages/database/src/migrations/data-preservation.sql');
    mkdirSync(dirname(migrationPath), { recursive: true });
    writeFileSync(migrationPath, migrationScript);
    this.log('Data preservation migration script created');
  }

  private async updatePackageReferences(): Promise<void> {
    console.log('📦 Updating package references...');
    
    // Update server package.json to reference shared packages
    const serverPackagePath = join(rootDir, 'apps/server/package.json');
    if (existsSync(serverPackagePath)) {
      const packageJson = JSON.parse(readFileSync(serverPackagePath, 'utf-8'));
      
      // Add workspace dependencies
      packageJson.dependencies = {
        ...packageJson.dependencies,
        '@taskmanagement/shared': 'workspace:*',
        '@taskmanagement/database': 'workspace:*',
        '@taskmanagement/config': 'workspace:*',
      };

      writeFileSync(serverPackagePath, JSON.stringify(packageJson, null, 2));
      this.log('Updated server package.json with workspace dependencies');
    }

    // Update client package.json if it exists
    const clientPackagePath = join(rootDir, 'apps/client/package.json');
    if (existsSync(clientPackagePath)) {
      const packageJson = JSON.parse(readFileSync(clientPackagePath, 'utf-8'));
      
      packageJson.dependencies = {
        ...packageJson.dependencies,
        '@taskmanagement/shared': 'workspace:*',
        '@taskmanagement/ui': 'workspace:*',
        '@taskmanagement/config': 'workspace:*',
      };

      writeFileSync(clientPackagePath, JSON.stringify(packageJson, null, 2));
      this.log('Updated client package.json with workspace dependencies');
    }
  }

  private async validateMigration(): Promise<void> {
    console.log('✅ Validating migration integrity...');
    
    // Run database integrity checks
    try {
      execSync('npm run db:push --dry-run', { cwd: join(rootDir, 'packages/database'), stdio: 'pipe' });
      this.log('Database schema validation passed');
    } catch (error) {
      throw new Error(`Database schema validation failed: ${error}`);
    }

    // Validate package dependencies
    try {
      execSync('npm install', { cwd: rootDir, stdio: 'pipe' });
      this.log('Package dependencies validation passed');
    } catch (error) {
      throw new Error(`Package dependencies validation failed: ${error}`);
    }

    // Run type checking
    try {
      execSync('npm run type-check', { cwd: join(rootDir, 'apps/server'), stdio: 'pipe' });
      this.log('TypeScript validation passed');
    } catch (error) {
      console.warn('⚠️  TypeScript validation failed, manual fixes may be required');
    }
  }

  private async rollback(): Promise<void> {
    console.log('🔄 Rolling back migration...');
    
    if (existsSync(this.backupDir)) {
      // Restore configuration files
      const configFiles = [
        'apps/server/.env',
        'apps/server/package.json',
        'apps/server/drizzle.config.ts'
      ];

      for (const file of configFiles) {
        const backupPath = join(this.backupDir, file);
        const targetPath = join(rootDir, file);
        
        if (existsSync(backupPath)) {
          copyFileSync(backupPath, targetPath);
          this.log(`Restored: ${file}`);
        }
      }

      // Restore database if backup exists
      const dbBackupPath = join(this.backupDir, 'database-backup.sql');
      if (existsSync(dbBackupPath)) {
        try {
          const dbUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/taskmanagement';
          execSync(`psql "${dbUrl}" < "${dbBackupPath}"`, { stdio: 'inherit' });
          this.log('Database restored from backup');
        } catch (error) {
          console.error('Failed to restore database:', error);
        }
      }
    }
  }

  private async generateMigrationReport(): Promise<void> {
    const reportPath = join(rootDir, 'migration-report.md');
    const report = `# Monorepo Migration Report

## Migration Summary
- **Date**: ${new Date().toISOString()}
- **Status**: Completed Successfully
- **Backup Location**: ${this.backupDir}

## Migration Steps Completed
${this.migrationLog.map(log => `- ${log}`).join('\n')}

## Post-Migration Steps
1. Run \`npm install\` to install dependencies
2. Run \`npm run db:push\` to apply database changes
3. Run \`npm run build\` to build all packages
4. Run \`npm run test\` to verify functionality
5. Update any remaining import paths manually

## Rollback Instructions
If you need to rollback this migration:
1. Run the rollback script: \`npm run migrate:rollback\`
2. Restore from backup directory: \`${this.backupDir}\`

## Next Steps
- Review and update any remaining import paths
- Test all functionality thoroughly
- Update CI/CD pipelines for monorepo structure
- Update documentation
`;

    writeFileSync(reportPath, report);
    console.log(`📋 Migration report generated: ${reportPath}`);
  }

  private log(message: string): void {
    this.migrationLog.push(`${new Date().toISOString()}: ${message}`);
    console.log(`  ${message}`);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const config: MigrationConfig = {
    sourceDir: join(rootDir, 'apps/server'),
    targetDir: rootDir,
    preserveData: !args.includes('--no-preserve-data'),
    createBackup: !args.includes('--no-backup'),
    validateIntegrity: !args.includes('--no-validate'),
  };

  if (args.includes('--help')) {
    console.log(`
Usage: npm run migrate:monorepo [options]

Options:
  --no-preserve-data    Skip data preservation steps
  --no-backup          Skip backup creation
  --no-validate        Skip migration validation
  --help               Show this help message
`);
    return;
  }

  const migrator = new MonorepoMigrator(config);
  await migrator.migrate();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { MonorepoMigrator };
