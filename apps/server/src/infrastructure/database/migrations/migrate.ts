import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { DatabaseConnection } from '../connection';

export async function runMigrations(config: {
  connectionString: string;
  migrationsFolder?: string;
}): Promise<void> {
  const dbConnection = DatabaseConnection.getInstance({
    connectionString: config.connectionString,
  });

  try {
    await dbConnection.connect();

    console.log('Running database migrations...');

    await migrate(dbConnection.db, {
      migrationsFolder:
        config.migrationsFolder || './src/infrastructure/database/migrations',
    });

    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await dbConnection.disconnect();
  }
}

// CLI runner for migrations
if (require.main === module) {
  const connectionString =
    process.env.DATABASE_URL || 'postgresql://localhost:5432/taskmanagement';

  runMigrations({ connectionString })
    .then(() => {
      console.log('Migration process completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration process failed:', error);
      process.exit(1);
    });
}
