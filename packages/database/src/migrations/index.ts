// Migration utilities and scripts
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, connection } from '../client';

export async function runMigrations() {
  try {
    console.log('Running database migrations...');
    await migrate(db, { migrationsFolder: './migrations' });
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

export async function closeMigrationConnection() {
  await connection.end();
}