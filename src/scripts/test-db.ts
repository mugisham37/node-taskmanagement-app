import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import logger from '../config/logger';
import { createDatabaseIfNotExists, testConnection } from '../config/database';

dotenv.config();

async function testDatabase() {
  try {
    logger.info('🧪 Testing database setup...');

    // Test 1: Create database if it doesn't exist
    logger.info('📦 Creating database if it doesn\'t exist...');
    await createDatabaseIfNotExists();

    // Test 2: Test connection
    logger.info('🔗 Testing database connection...');
    const connected = await testConnection();
    
    if (!connected) {
      throw new Error('Database connection failed');
    }

    // Test 3: Check if tables exist
    logger.info('📋 Checking if tables exist...');
    const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:moses@localhost:5432/Task-Management';
    
    const pool = new Pool({
      connectionString,
      max: 1,
    });

    const db = drizzle(pool);

    // Query to check if our main tables exist
    const tableCheckQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    const result = await pool.query(tableCheckQuery);
    const tables = result.rows.map(row => row.table_name);

    logger.info('✅ Found tables:', tables);

    // Check for our expected tables
    const expectedTables = [
      'users', 'projects', 'tasks', 'teams', 'workspaces',
      'activities', 'calendar_events', 'comments', 'notifications',
      'invitations', 'feedback', 'audit_logs'
    ];

    const missingTables = expectedTables.filter(table => !tables.includes(table));
    
    if (missingTables.length > 0) {
      logger.warn('⚠️ Missing tables:', missingTables);
    } else {
      logger.info('✅ All core tables are present!');
    }

    // Test 4: Test a simple query
    logger.info('🔍 Testing a simple query...');
    const countQuery = 'SELECT COUNT(*) as count FROM users';
    const countResult = await pool.query(countQuery);
    logger.info(`👥 Users table has ${countResult.rows[0].count} records`);

    await pool.end();
    
    logger.info('✅ Database test completed successfully!');
    logger.info('🎉 Database setup is working correctly!');

    process.exit(0);
  } catch (error) {
    logger.error('❌ Database test failed:', error);
    process.exit(1);
  }
}

testDatabase();
