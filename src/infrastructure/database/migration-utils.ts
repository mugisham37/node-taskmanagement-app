import { execSync } from 'child_process';
import { logger } from '@/infrastructure/logging/logger';
import { config } from '@/infrastructure/config/environment';

export interface MigrationResult {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Run database migrations
 */
export async function runMigrations(): Promise<MigrationResult> {
  try {
    logger.info('Running database migrations...');

    const command = config.app.isProduction
      ? 'npx prisma migrate deploy'
      : 'npx prisma migrate dev';

    execSync(command, { stdio: 'inherit' });

    logger.info('Database migrations completed successfully');
    return {
      success: true,
      message: 'Migrations completed successfully',
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error('Database migration failed:', error);

    return {
      success: false,
      message: 'Migration failed',
      error: errorMessage,
    };
  }
}

/**
 * Reset database (development only)
 */
export async function resetDatabase(): Promise<MigrationResult> {
  if (config.app.isProduction) {
    return {
      success: false,
      message: 'Database reset is not allowed in production',
      error: 'Operation not permitted in production environment',
    };
  }

  try {
    logger.info('Resetting database...');

    execSync('npx prisma migrate reset --force', { stdio: 'inherit' });

    logger.info('Database reset completed successfully');
    return {
      success: true,
      message: 'Database reset completed successfully',
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error('Database reset failed:', error);

    return {
      success: false,
      message: 'Database reset failed',
      error: errorMessage,
    };
  }
}

/**
 * Generate Prisma client
 */
export async function generatePrismaClient(): Promise<MigrationResult> {
  try {
    logger.info('Generating Prisma client...');

    execSync('npx prisma generate', { stdio: 'inherit' });

    logger.info('Prisma client generated successfully');
    return {
      success: true,
      message: 'Prisma client generated successfully',
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error('Prisma client generation failed:', error);

    return {
      success: false,
      message: 'Prisma client generation failed',
      error: errorMessage,
    };
  }
}

/**
 * Check migration status
 */
export async function checkMigrationStatus(): Promise<{
  hasPendingMigrations: boolean;
  migrations: string[];
}> {
  try {
    const output = execSync('npx prisma migrate status', {
      encoding: 'utf8',
      stdio: 'pipe',
    });

    const hasPendingMigrations = output.includes(
      'Following migration(s) have not yet been applied'
    );
    const migrations = output
      .split('\n')
      .filter(line => line.trim().startsWith('└─'));

    return {
      hasPendingMigrations,
      migrations,
    };
  } catch (error) {
    logger.error('Failed to check migration status:', error);
    return {
      hasPendingMigrations: false,
      migrations: [],
    };
  }
}

/**
 * Create a new migration
 */
export async function createMigration(name: string): Promise<MigrationResult> {
  try {
    logger.info(`Creating migration: ${name}`);

    execSync(`npx prisma migrate dev --name ${name}`, { stdio: 'inherit' });

    logger.info(`Migration "${name}" created successfully`);
    return {
      success: true,
      message: `Migration "${name}" created successfully`,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error('Migration creation failed:', error);

    return {
      success: false,
      message: 'Migration creation failed',
      error: errorMessage,
    };
  }
}
