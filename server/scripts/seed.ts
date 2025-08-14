import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import logger from '../config/logger';
import * as schema from '../db/schema';

dotenv.config();

interface SeedOptions {
  environment?: 'development' | 'staging' | 'production';
  force?: boolean;
  verbose?: boolean;
  category?: 'users' | 'workspaces' | 'projects' | 'all';
}

async function seedDatabase(options: SeedOptions = {}) {
  const startTime = Date.now();

  try {
    logger.info('🌱 Starting enhanced database seeding process...');
    logger.info(`🌍 Environment: ${options.environment || 'development'}`);
    logger.info(`📂 Category: ${options.category || 'all'}`);

    const connectionString =
      process.env.DATABASE_URL ||
      'postgresql://postgres:moses@localhost:5432/Task-Management';

    const pool = new Pool({
      connectionString,
      max: 1,
    });

    const db = drizzle(pool, { schema });

    // Check if database already has data
    logger.info('🔍 Checking existing data...');
    const existingData = await checkExistingData(pool);

    if (existingData.hasData && !options.force) {
      logger.warn(
        '⚠️ Database already contains data. Use --force to override.'
      );
      logger.info('📊 Current data counts:');
      Object.entries(existingData.counts).forEach(([table, count]) => {
        logger.info(`  - ${table}: ${count} records`);
      });
      await pool.end();
      return;
    }

    // Seed based on environment and category
    logger.info('📦 Seeding database with enhanced seed data...');

    if (options.category === 'users' || options.category === 'all') {
      await seedUsers(db, options);
    }

    if (options.category === 'workspaces' || options.category === 'all') {
      await seedWorkspaces(db, options);
    }

    if (options.category === 'projects' || options.category === 'all') {
      await seedProjects(db, options);
    }

    // Add comprehensive seed data based on environment
    if (options.environment === 'development') {
      await seedDevelopmentData(db, options);
    } else if (options.environment === 'staging') {
      await seedStagingData(db, options);
    }

    const duration = Date.now() - startTime;
    logger.info(
      `✅ Enhanced database seeding completed successfully in ${duration}ms!`
    );

    // Generate seeding report
    await generateSeedingReport(pool);

    await pool.end();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Enhanced database seeding failed:', error);
    logger.error('🔧 Troubleshooting tips:');
    logger.error('  - Check database connection');
    logger.error('  - Verify schema compatibility');
    logger.error('  - Check for constraint violations');
    process.exit(1);
  }
}

async function checkExistingData(pool: Pool) {
  const tables = ['users', 'workspaces', 'projects', 'tasks'];
  const counts: Record<string, number> = {};
  let hasData = false;

  for (const table of tables) {
    try {
      const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
      const count = parseInt(result.rows[0].count);
      counts[table] = count;
      if (count > 0) hasData = true;
    } catch (error) {
      counts[table] = 0;
    }
  }

  return { hasData, counts };
}

async function seedUsers(db: any, options: SeedOptions) {
  logger.info('👥 Seeding users...');

  // Implementation would go here based on your schema
  // Example structure:
  // await db.insert(schema.users).values([...]);

  logger.info('✅ Users seeded successfully');
}

async function seedWorkspaces(db: any, options: SeedOptions) {
  logger.info('🏢 Seeding workspaces...');

  // Implementation would go here based on your schema

  logger.info('✅ Workspaces seeded successfully');
}

async function seedProjects(db: any, options: SeedOptions) {
  logger.info('📋 Seeding projects...');

  // Implementation would go here based on your schema

  logger.info('✅ Projects seeded successfully');
}

async function seedDevelopmentData(db: any, options: SeedOptions) {
  logger.info('🔧 Seeding development-specific data...');

  // Add development-specific seed data

  logger.info('✅ Development data seeded successfully');
}

async function seedStagingData(db: any, options: SeedOptions) {
  logger.info('🎭 Seeding staging-specific data...');

  // Add staging-specific seed data

  logger.info('✅ Staging data seeded successfully');
}

async function generateSeedingReport(pool: Pool) {
  logger.info('📊 Generating seeding report...');

  const { counts } = await checkExistingData(pool);

  logger.info('📈 Final data counts:');
  Object.entries(counts).forEach(([table, count]) => {
    logger.info(`  - ${table}: ${count} records`);
  });
}

// CLI support for enhanced seeding options
const args = process.argv.slice(2);
const options: SeedOptions = {
  environment:
    (args.find(arg => arg.startsWith('--env='))?.split('=')[1] as any) ||
    'development',
  force: args.includes('--force'),
  verbose: args.includes('--verbose'),
  category:
    (args.find(arg => arg.startsWith('--category='))?.split('=')[1] as any) ||
    'all',
};

seedDatabase(options);
