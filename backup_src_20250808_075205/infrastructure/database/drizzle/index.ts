// Core database exports
export * from './connection';
export * from './health';
export * from './setup';

// Schema exports
export * from './schema';

// Repository exports
export * from './repositories';

// Migration exports
export * from './migrations/migration-runner';

// Re-export commonly used utilities
export { 
  initializeDatabase, 
  validateDatabase, 
  generateDatabaseReport,
  DatabaseSetup,
  type DatabaseSetupOptions,
  type DatabaseSetupResult
} from './setup';

export {
  checkDatabaseHealth,
  getDatabaseMetrics,
  dbHealthMonitor,
  type DatabaseHealthMetrics
} from './health';

export {
  migrationRunner,
  runMigrations,
  showMigrationStatus,
  validateMigrations,
  type Migration,
  type MigrationRecord
} from './migrations/migration-runner';

export {
  testConnection,
  closeConnection,
  db,
  pool
} from './connection';

export {
  repositories,
  type Repositories,
  type RepositoryName
} from './repositories';
