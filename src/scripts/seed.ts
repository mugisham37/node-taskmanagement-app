import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import logger from '../config/logger';
import * as schema from '../db/schema';

dotenv.config();

async function seedDatabase() {
  try {
    logger.info('🌱 Starting database seeding process...');

    const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:moses@localhost:5432/Task-Management';
    
    const pool = new Pool({
      connectionString,
      max: 1,
    });

    const db = drizzle(pool, { schema });

    logger.info('📦 Seeding database with initial data...');

    // Add your seed data here
    // Example:
    // await db.insert(schema.users).values([
    //   {
    //     email: 'admin@example.com',
    //     name: 'Admin User',
    //     // ... other fields
    //   }
    // ]);

    logger.info('✅ Database seeding completed successfully!');

    await pool.end();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Database seeding failed:', error);
    process.exit(1);
  }
}

seedDatabase();
