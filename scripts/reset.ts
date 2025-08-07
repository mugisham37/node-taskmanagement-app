import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import logger from '../config/logger';

dotenv.config();

async function resetDatabase() {
  try {
    logger.info('🔄 Starting database reset process...');

    const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:moses@localhost:5432/Task-Management';
    
    const pool = new Pool({
      connectionString,
      max: 1,
    });

    const db = drizzle(pool);

    logger.info('🗑️ Dropping all tables...');

    // Drop all tables in reverse order to handle foreign key constraints
    const dropQueries = [
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
      'DROP TABLE IF EXISTS tasks CASCADE;',
      'DROP TABLE IF EXISTS projects CASCADE;',
      'DROP TABLE IF EXISTS team_members CASCADE;',
      'DROP TABLE IF EXISTS teams CASCADE;',
      'DROP TABLE IF EXISTS workspace_members CASCADE;',
      'DROP TABLE IF EXISTS workspaces CASCADE;',
      'DROP TABLE IF EXISTS users CASCADE;',
      'DROP TABLE IF EXISTS __drizzle_migrations CASCADE;'
    ];

    for (const query of dropQueries) {
      try {
        await pool.query(query);
      } catch (error) {
        // Ignore errors for tables that don't exist
        logger.debug(`Ignoring error for query: ${query}`, error);
      }
    }

    logger.info('✅ Database reset completed successfully!');

    await pool.end();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Database reset failed:', error);
    process.exit(1);
  }
}

resetDatabase();
