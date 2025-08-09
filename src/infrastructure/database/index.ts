// Export main database components
export {
  DatabaseConnection,
  createDatabaseConnection,
  getDatabase,
} from './connection';
export type { DatabaseConfig } from './connection';

// Export configuration utilities
export {
  createDatabaseConfig,
  validateDatabaseConfig,
  DATABASE_ENVIRONMENTS,
} from './config';
export type { DatabaseEnvironment, DatabaseEnvironmentConfig } from './config';

// Export health checking
export { DatabaseHealthChecker } from './health-check';
export type { DatabaseHealthStatus } from './health-check';

// Export migration utilities
export { runMigrations } from './migrations/migrate';

// Export transaction management
export {
  TransactionManager,
  createTransactionManager,
} from './transaction-manager';
export type {
  TransactionOptions,
  TransactionContext,
} from './transaction-manager';

// Export query optimization
export { QueryOptimizer, createQueryOptimizer } from './query-optimizer';
export type {
  QueryPerformanceMetrics,
  IndexSuggestion,
  QueryOptimizationReport,
  TableStatistics,
} from './query-optimizer';

// Export performance optimization
export {
  DatabasePerformanceOptimizer,
  createDatabasePerformanceOptimizer,
} from './performance-optimizer';
export type {
  DatabasePerformanceConfig,
  ConnectionPoolMetrics,
  DatabaseIndexInfo,
} from './performance-optimizer';

// Export seeding utilities
export { DatabaseSeeder } from './seeds';
export type { SeedOptions } from './seeds';

// Export backup and recovery utilities
export {
  BackupRecoveryManager,
  createBackupRecoveryManager,
} from './backup-recovery';
export type {
  BackupOptions,
  RestoreOptions,
  BackupMetadata,
} from './backup-recovery';

// Export schema
export * from './schema';

// Export repository implementations
export * from './repositories';

// Export repository interfaces
export * from '../../domain/repositories';
