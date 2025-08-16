// Export main database components
export { DatabaseConnection, createDatabaseConnection, getDatabase } from './connection';
export type { DatabaseConfig } from './connection';

// Export configuration utilities
export { DATABASE_ENVIRONMENTS, createDatabaseConfig, validateDatabaseConfig } from './config';
export type { DatabaseEnvironment, DatabaseEnvironmentConfig } from './config';

// Export health checking
export { DatabaseHealthChecker } from './health-check';
export type { DatabaseHealthStatus } from './health-check';

// Export migration utilities
export { runMigrations } from './migrations/migrate';

// Export transaction management
export { TransactionManager, createTransactionManager } from './transaction-manager';
export type { TransactionContext, TransactionOptions } from './transaction-manager';

// Export query optimization
export { QueryOptimizer, createQueryOptimizer } from './query-optimizer';
export type {
  IndexSuggestion,
  QueryOptimizationReport,
  QueryPerformanceMetrics,
  TableStatistics,
} from './query-optimizer';

// Export performance optimization
export {
  DatabasePerformanceOptimizer,
  createDatabasePerformanceOptimizer,
} from './performance-optimizer';
export type {
  ConnectionPoolMetrics,
  DatabaseIndexInfo,
  DatabasePerformanceConfig,
} from './performance-optimizer';

// Export seeding utilities
export { DatabaseSeeder } from './seeds';
export type { SeedOptions } from './seeds';

// Export backup and recovery utilities
export { BackupRecoveryManager, createBackupRecoveryManager } from './backup-recovery';
export type { BackupMetadata, BackupOptions, RestoreOptions } from './backup-recovery';

// Export schema
export * from './schema';

// Export types
export * from './types';

// Export mappers
export * from './mappers/project-mapper';

// Export repository implementations
export * from './repositories';

// Export repository interfaces (avoiding conflicts)
export type {
  IProjectRepository,
  ProjectFilters,
  ProjectSortOptions,
} from '@taskmanagement/domain';
