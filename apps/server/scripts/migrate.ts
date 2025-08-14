import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { createDatabaseIfNotExists } from '../config/database';
import logger from '../config/logger';

dotenv.config();

interface MigrationOptions {
  rollback?: boolean;
  target?: string;
  dryRun?: boolean;
  verbose?: boolean;
}

async function runMigrations(options: MigrationOptions = {}) {
  const startTime = Date.now();

  try {
    logger.info('🚀 Starting enhanced database migration process...');

    if (options.dryRun) {
      logger.info('🔍 Running in dry-run mode - no changes will be applied');
    }

    // First, create the database if it doesn't exist
    await createDatabaseIfNotExists();

    // Connect to the target database
    const connectionString =
      process.env.DATABASE_URL ||
      'postgresql://postgres:moses@localhost:5432/Task-Management';

    const pool = new Pool({
      connectionString,
      max: 1,
    });

    const db = drizzle(pool);

    // Check current migration status
    logger.info('📋 Checking current migration status...');
    try {
      const migrationStatus = await pool.query(`
        SELECT version, applied_at 
        FROM __drizzle_migrations 
        ORDER BY applied_at DESC 
        LIMIT 5
      `);

      if (migrationStatus.rows.length > 0) {
        logger.info('📊 Recent migrations:');
        migrationStatus.rows.forEach(row => {
          logger.info(`  - ${row.version} (applied: ${row.applied_at})`);
        });
      } else {
        logger.info('📝 No previous migrations found');
      }
    } catch (error) {
      logger.info(
        '📝 Migration table not found - this appears to be the first migration'
      );
    }

    if (!options.dryRun) {
      logger.info('📦 Running Drizzle migrations...');

      // Run migrations with enhanced error handling
      await migrate(db, {
        migrationsFolder: './src/db/migrations',
        migrationsTable: '__drizzle_migrations',
      });

      // Verify migration success
      logger.info('🔍 Verifying migration success...');
      const postMigrationStatus = await pool.query(`
        SELECT COUNT(*) as migration_count 
        FROM __drizzle_migrations
      `);

      logger.info(
        `✅ Total migrations applied: ${postMigrationStatus.rows[0].migration_count}`
      );
    }

    // Enhanced migration tracking and rollback capabilities
    if (options.rollback) {
      logger.warn('⚠️ Rollback functionality requires manual implementation');
      logger.info('💡 Consider using database backups for rollback scenarios');
    }

    const duration = Date.now() - startTime;
    logger.info(
      `✅ Migration process completed successfully in ${duration}ms!`
    );

    await pool.end();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Enhanced migration failed:', error);
    logger.error('🔧 Troubleshooting tips:');
    logger.error('  - Check database connection string');
    logger.error('  - Verify database permissions');
    logger.error('  - Check migration file syntax');
    logger.error('  - Review database logs for detailed errors');
    process.exit(1);
  }
}

// CLI support for enhanced migration options
const args = process.argv.slice(2);
const options: MigrationOptions = {
  rollback: args.includes('--rollback'),
  dryRun: args.includes('--dry-run'),
  verbose: args.includes('--verbose'),
  target: args.find(arg => arg.startsWith('--target='))?.split('=')[1],
};

runMigrations(options);
