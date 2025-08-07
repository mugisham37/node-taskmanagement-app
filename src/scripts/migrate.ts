import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { createDatabaseIfNotExists } from '../config/database';
import logger from '../config/logger';

dotenv.config();

async function runMigrations() {
  try {
    logger.info('🚀 Starting database migration process...');

    // First, create the database if it doesn't exist
    await createDatabaseIfNotExists();

    // Connect to the target database
    const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:moses@localhost:5432/Task-Management';
    
    const pool = new Pool({
      connectionString,
      max: 1,
    });

    const db = drizzle(pool);

    logger.info('📦 Running migrations...');
    
    // Run migrations
    await migrate(db, { migrationsFolder: './src/db/migrations' });

    logger.info('✅ Migrations completed successfully!');

    await pool.end();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
