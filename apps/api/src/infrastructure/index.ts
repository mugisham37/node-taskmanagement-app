// Database - now exported from @taskmanagement/database package
// export * from './database';

// Caching
export * from './caching';

// External Services - now from integrations package
export * from '@taskmanagement/integrations';

// Security
export * from './security';

// Monitoring - now from observability package
export * from '@taskmanagement/observability';

// Migration
export * from './migration/fastify-migration.controller';
export * from './migration/migration-routes';
export * from './migration/migration.module';

// Integration
export * from './integration/infrastructure-integration';

// Performance Optimization
export * from './performance-optimization-service';

// Jobs and Background Processing - now from jobs package
export * from '@taskmanagement/jobs';

// Enhanced services from migration
// Database exports moved to @taskmanagement/database package
// export { DrizzleQueryOptimizer, drizzleQueryOptimizer } from './database/drizzle-query-optimizer';
// export { DrizzleTransactionManager, drizzleTransactionManager } from './database/drizzle-transaction-manager';
// export { BaseDrizzleRepository } from './database/repositories/base-drizzle-repository';
// Enhanced services now from packages
export {
  CircuitBreaker,
  CircuitBreakerRegistry,
  EmailConfig,
  EmailService,
  SendEmailData,
  circuitBreakerRegistry,
} from '@taskmanagement/integrations';
export {
  EnhancedMonitoringService,
  enhancedMonitoringService,
} from '@taskmanagement/observability';
