// Database - now exported from @taskmanagement/database package
// export * from './database';

// Caching
export * from './caching/index';

// External Services - now from integrations package
// TODO: Replace with actual package when built
// export * from '@taskmanagement/integrations';

// Security
export * from './security/index';

// Monitoring - temporarily comment out until packages are built
// export * from '@taskmanagement/observability';

// Migration
export * from './migration/fastify-migration.controller';
export * from './migration/migration-routes';
export * from './migration/migration.module';

// Integration
export * from './integration/infrastructure-integration';

// Performance Optimization
export * from './performance-optimization-service';

// Jobs and Background Processing - now from jobs package
// TODO: Replace with actual package when built
// export * from '@taskmanagement/jobs';

// Enhanced services from migration
// Database exports moved to @taskmanagement/database package
// export { DrizzleQueryOptimizer, drizzleQueryOptimizer } from './database/drizzle-query-optimizer';
// export { DrizzleTransactionManager, drizzleTransactionManager } from './database/drizzle-transaction-manager';
// export { BaseDrizzleRepository } from './database/repositories/base-drizzle-repository';
// Enhanced services now from packages
// TODO: Replace with actual package exports when built
export {
  CircuitBreaker,
  CircuitBreakerRegistry,
  circuitBreakerRegistry,
  EmailConfig,
  EmailService,
  SendEmailData,
} from './stubs';

// TODO: Uncomment when observability package is built
// export {
//   EnhancedMonitoringService,
//   enhancedMonitoringService,
// } from '@taskmanagement/observability';
