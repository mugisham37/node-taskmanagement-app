import { DatabaseConfig } from './connection';

export interface DatabaseEnvironmentConfig {
  development: DatabaseConfig;
  test: DatabaseConfig;
  staging: DatabaseConfig;
  production: DatabaseConfig;
}

export function createDatabaseConfig(
  environment: string = 'development'
): DatabaseConfig {
  const baseConfig = {
    maxConnections: 20,
    idleTimeout: 20,
    connectionTimeout: 10,
    ssl: false,
  };

  switch (environment) {
    case 'development':
      return {
        ...baseConfig,
        connectionString:
          process.env.DATABASE_URL ||
          'postgresql://localhost:5432/taskmanagement_dev',
        maxConnections: 10,
        ssl: false,
      };

    case 'test':
      return {
        ...baseConfig,
        connectionString:
          process.env.TEST_DATABASE_URL ||
          'postgresql://localhost:5432/taskmanagement_test',
        maxConnections: 5,
        ssl: false,
      };

    case 'staging':
      return {
        ...baseConfig,
        connectionString:
          process.env.DATABASE_URL ||
          'postgresql://localhost:5432/taskmanagement_staging',
        maxConnections: 15,
        ssl: true,
      };

    case 'production':
      return {
        ...baseConfig,
        connectionString: process.env.DATABASE_URL!,
        maxConnections: 30,
        idleTimeout: 30,
        connectionTimeout: 15,
        ssl: true,
      };

    default:
      throw new Error(`Unknown environment: ${environment}`);
  }
}

export function validateDatabaseConfig(config: DatabaseConfig): void {
  if (!config.connectionString) {
    throw new Error('Database connection string is required');
  }

  if (config.maxConnections && config.maxConnections < 1) {
    throw new Error('Max connections must be at least 1');
  }

  if (config.idleTimeout && config.idleTimeout < 1) {
    throw new Error('Idle timeout must be at least 1 second');
  }

  if (config.connectionTimeout && config.connectionTimeout < 1) {
    throw new Error('Connection timeout must be at least 1 second');
  }

  // Validate connection string format
  try {
    new URL(config.connectionString);
  } catch (error) {
    throw new Error('Invalid database connection string format');
  }
}

export const DATABASE_ENVIRONMENTS = [
  'development',
  'test',
  'staging',
  'production',
] as const;
export type DatabaseEnvironment = (typeof DATABASE_ENVIRONMENTS)[number];
