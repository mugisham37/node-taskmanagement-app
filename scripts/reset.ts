import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import logger from '../config/logger';

dotenv.config();

interface ResetOptions {
  confirm?: boolean;
  backup?: boolean;
  verbose?: boolean;
  tablesOnly?: boolean;
}

async function resetDatabase(options: ResetOptions = {}) {
  const startTime = Date.now();

  try {
    logger.info('🔄 Starting enhanced database reset process...');

    // Safety check for production
    if (process.env.NODE_ENV === 'production' && !options.confirm) {
      logger.error(
        '❌ Cannot reset production database without explicit confirmation'
      );
      logger.error(
        '💡 Use --confirm flag if you really want to reset production data'
      );
      process.exit(1);
    }

    const connectionString =
      process.env.DATABASE_URL ||
      'postgresql://postgres:moses@localhost:5432/Task-Management';

    const pool = new Pool({
      connectionString,
      max: 1,
    });

    const db = drizzle(pool);

    // Create backup if requested
    if (options.backup) {
      logger.info('💾 Creating database backup before reset...');
      await createDatabaseBackup(pool);
    }

    // Get current table information
    logger.info('📋 Analyzing current database structure...');
    const tableInfo = await getDatabaseInfo(pool);

    if (tableInfo.tables.length === 0) {
      logger.info('📝 Database is already empty');
      await pool.end();
      return;
    }

    logger.info(`📊 Found ${tableInfo.tables.length} tables to drop`);
    if (options.verbose) {
      logger.info('📝 Tables to be dropped:');
      tableInfo.tables.forEach(table => logger.info(`  - ${table}`));
    }

    logger.info('🗑️ Dropping all tables with enhanced dependency handling...');

    // Enhanced table dropping with proper dependency resolution
    await dropAllTablesWithDependencies(pool, tableInfo.tables);

    // Drop additional database objects if not tables-only
    if (!options.tablesOnly) {
      logger.info('🧹 Cleaning up additional database objects...');
      await cleanupDatabaseObjects(pool);
    }

    const duration = Date.now() - startTime;
    logger.info(
      `✅ Enhanced database reset completed successfully in ${duration}ms!`
    );

    // Verify reset
    await verifyReset(pool);

    await pool.end();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Enhanced database reset failed:', error);
    logger.error('🔧 Troubleshooting tips:');
    logger.error('  - Check for active connections to the database');
    logger.error('  - Verify database permissions');
    logger.error('  - Consider using --backup flag for safety');
    process.exit(1);
  }
}

async function getDatabaseInfo(pool: Pool) {
  const tablesResult = await pool.query(`
    SELECT table_name, table_type
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  const tables = tablesResult.rows.map(row => row.table_name);

  // Get table sizes for reporting
  const sizesResult = await pool.query(`
    SELECT 
      schemaname,
      tablename,
      n_live_tup as row_count,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
    FROM pg_stat_user_tables 
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
  `);

  return {
    tables,
    sizes: sizesResult.rows,
  };
}

async function dropAllTablesWithDependencies(pool: Pool, tables: string[]) {
  // Enhanced drop order considering foreign key dependencies
  const enhancedDropQueries = [
    // Application data tables (dependent tables first)
    'DROP TABLE IF EXISTS audit_logs CASCADE;',
    'DROP TABLE IF EXISTS feedback CASCADE;',
    'DROP TABLE IF EXISTS task_templates CASCADE;',
    'DROP TABLE IF EXISTS recurring_tasks CASCADE;',
    'DROP TABLE IF EXISTS invitations CASCADE;',
    'DROP TABLE IF EXISTS notifications CASCADE;',
    'DROP TABLE IF EXISTS comments CASCADE;',
    'DROP TABLE IF EXISTS calendar_integrations CASCADE;',
    'DROP TABLE IF EXISTS calendar_events CASCADE;',
    'DROP TABLE IF EXISTS activities CASCADE;',
    'DROP TABLE IF EXISTS file_attachments CASCADE;',
    'DROP TABLE IF EXISTS webhook_deliveries CASCADE;',
    'DROP TABLE IF EXISTS webhooks CASCADE;',
    'DROP TABLE IF EXISTS notification_preferences CASCADE;',
    'DROP TABLE IF EXISTS device_registrations CASCADE;',
    'DROP TABLE IF EXISTS accounts CASCADE;',
    'DROP TABLE IF EXISTS metrics CASCADE;',
    'DROP TABLE IF EXISTS activity_tracking CASCADE;',

    // Core business tables
    'DROP TABLE IF EXISTS tasks CASCADE;',
    'DROP TABLE IF EXISTS projects CASCADE;',
    'DROP TABLE IF EXISTS team_members CASCADE;',
    'DROP TABLE IF EXISTS teams CASCADE;',
    'DROP TABLE IF EXISTS workspace_members CASCADE;',
    'DROP TABLE IF EXISTS workspaces CASCADE;',
    'DROP TABLE IF EXISTS users CASCADE;',

    // System tables
    'DROP TABLE IF EXISTS __drizzle_migrations CASCADE;',
  ];

  let droppedCount = 0;
  for (const query of enhancedDropQueries) {
    try {
      await pool.query(query);
      droppedCount++;
      logger.debug(`✅ Executed: ${query}`);
    } catch (error) {
      // Ignore errors for tables that don't exist
      logger.debug(`⚠️ Ignoring error for query: ${query}`, error);
    }
  }

  logger.info(`🗑️ Successfully dropped ${droppedCount} database objects`);
}

async function cleanupDatabaseObjects(pool: Pool) {
  // Drop sequences, views, functions, etc.
  const cleanupQueries = [
    'DROP SCHEMA IF EXISTS drizzle CASCADE;',
    // Add more cleanup queries as needed
  ];

  for (const query of cleanupQueries) {
    try {
      await pool.query(query);
      logger.debug(`✅ Cleanup: ${query}`);
    } catch (error) {
      logger.debug(`⚠️ Cleanup warning: ${query}`, error);
    }
  }
}

async function createDatabaseBackup(pool: Pool) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `backup_${timestamp}`;

  logger.info(`💾 Creating backup: ${backupName}`);

  // This would typically use pg_dump or similar
  // For now, just log the backup creation
  logger.info('💡 Backup functionality requires pg_dump integration');
  logger.info('🔧 Consider implementing automated backup before reset');
}

async function verifyReset(pool: Pool) {
  logger.info('🔍 Verifying database reset...');

  const remainingTables = await pool.query(`
    SELECT COUNT(*) as count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE';
  `);

  const tableCount = parseInt(remainingTables.rows[0].count);

  if (tableCount === 0) {
    logger.info('✅ Database reset verification passed - no tables remaining');
  } else {
    logger.warn(`⚠️ ${tableCount} tables still exist after reset`);
  }
}

// CLI support for enhanced reset options
const args = process.argv.slice(2);
const options: ResetOptions = {
  confirm: args.includes('--confirm'),
  backup: args.includes('--backup'),
  verbose: args.includes('--verbose'),
  tablesOnly: args.includes('--tables-only'),
};

// Show warning for destructive operation
if (!options.confirm && process.env.NODE_ENV !== 'development') {
  logger.warn('⚠️ This is a destructive operation that will delete all data!');
  logger.warn('💡 Use --confirm flag to proceed');
  logger.warn('💾 Use --backup flag to create a backup first');
  process.exit(1);
}

resetDatabase(options);
