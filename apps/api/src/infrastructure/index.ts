// Database - now exported from @taskmanagement/database package
// export * from './database';

// Caching
export * from './caching';

// External Services
export * from './external-services';

// Security
export * from './security';

// Monitoring (specific exports to avoid conflicts)
export {
  ComprehensiveMonitoring,
  HealthService,
  LoggingService,
  MetricsService,
  SystemHealth as MonitoringSystemHealth,
} from './monitoring';

// Migration
export * from './migration/fastify-migration.controller';
export * from './migration/migration-routes';
export * from './migration/migration.module';

// Integration
export * from './integration/infrastructure-integration';

// Performance Optimization
export * from './performance-optimization-service';

// Jobs and Background Processing
export * from './jobs';

// Enhanced services from migration
// Database exports moved to @taskmanagement/database package
// export { DrizzleQueryOptimizer, drizzleQueryOptimizer } from './database/drizzle-query-optimizer';
// export { DrizzleTransactionManager, drizzleTransactionManager } from './database/drizzle-transaction-manager';
// export { BaseDrizzleRepository } from './database/repositories/base-drizzle-repository';
export {
  CircuitBreaker,
  CircuitBreakerRegistry,
  circuitBreakerRegistry,
} from './external-services/circuit-breaker';
export { EmailConfig, EmailService, SendEmailData } from './external-services/email-service';
export {
  EnhancedMonitoringService,
  enhancedMonitoringService,
} from './monitoring/enhanced-monitoring-service';
