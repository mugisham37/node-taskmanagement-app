// Database
export * from './database';

// Caching
export * from './caching';

// External Services
export * from './external-services';

// Security
export * from './security';

// Monitoring (specific exports to avoid conflicts)
export {
  LoggingService,
  MetricsService,
  HealthService,
  SystemHealth as MonitoringSystemHealth,
  ComprehensiveMonitoring,
} from './monitoring';

// Migration
export * from './migration/migration.module';
export * from './migration/fastify-migration.controller';
export * from './migration/migration-routes';

// Integration
export * from './integration/infrastructure-integration';

// Performance Optimization
export * from './performance-optimization-service';

// Jobs and Background Processing
export * from './jobs';

// Enhanced services from migration
export { BaseDrizzleRepository } from './database/repositories/base-drizzle-repository';
export {
  DrizzleTransactionManager,
  drizzleTransactionManager,
} from './database/drizzle-transaction-manager';
export {
  DrizzleQueryOptimizer,
  drizzleQueryOptimizer,
} from './database/drizzle-query-optimizer';
export {
  EmailService,
  EmailConfig,
  SendEmailData,
} from './external-services/email-service';
export {
  CircuitBreaker,
  CircuitBreakerRegistry,
  circuitBreakerRegistry,
} from './external-services/circuit-breaker';
export {
  EnhancedMonitoringService,
  enhancedMonitoringService,
} from './monitoring/enhanced-monitoring-service';
