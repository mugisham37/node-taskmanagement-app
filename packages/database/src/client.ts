import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Database connection configuration
const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/taskmanagement';

// Create postgres connection
const connection = postgres(connectionString, {
  max: 20,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Create drizzle database instance with schema
export const db = drizzle(connection, { schema });

// Export connection for advanced usage
export { connection };

// Database health check
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    await connection`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
};

// Close database connection
export const closeDatabaseConnection = async (): Promise<void> => {
  await connection.end();
};