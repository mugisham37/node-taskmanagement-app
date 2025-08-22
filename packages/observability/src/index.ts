// Core monitoring services - primary exports
export { AlertingService } from './alerting-service';
export { LoggingService } from './logging-service';
export { MetricsService } from './metrics-service';

// Enhanced Monitoring Service
export {
  EnhancedMonitoringService,
  enhancedMonitoringService,
} from './enhanced-monitoring-service';

// Core types needed by consumers
export type {
  Alert,
  AlertAction,
  AlertCondition,
  AlertRule,
  AlertSeverity,
  AlertingConfig,
} from './alerting-service';

// Additional services
export * from './application-monitoring';
export * from './business-metrics-service';
export * from './monitoring-decorators';
export * from './monitoring-middleware';
export * from './performance-monitoring';

// API Performance Monitor
export { APIPerformanceMonitor, createAPIPerformanceMonitor } from './api-performance-monitor';
export type {
  PerformanceAlert as APIPerformanceAlert,
  PerformanceConfig as APIPerformanceConfig,
  APIPerformanceMetrics,
  EndpointStatistics,
} from './api-performance-monitor';

// Comprehensive Monitoring
export { ComprehensiveMonitoring } from './comprehensive-monitoring';
export type {
  Alert as ComprehensiveAlert,
  MonitoringConfig as ComprehensiveMonitoringConfig,
  ServiceHealthStatus,
  SystemHealthStatus,
  SystemMetrics,
} from './comprehensive-monitoring';

// Health Service
export { HealthService } from './health-service';
export type {
  HealthCheckResult as HealthCheck,
  HealthCheckConfig,
  HealthCheckFunction,
  SystemHealth as HealthStatus,
} from './health-service';
