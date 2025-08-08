// Core monitoring services
export { metricsService, MetricsService } from './metrics.service';
export {
  healthMonitor,
  HealthMonitor,
  DatabaseHealthCheck,
  RedisHealthCheck,
  SystemHealthCheck,
  ApplicationHealthCheck,
} from './health-check.service';
export { performanceMonitor, PerformanceMonitor } from './performance-monitor';
export { alertingService, AlertingService } from './alerting.service';
export {
  observabilityDashboard,
  ObservabilityDashboard,
} from './observability-dashboard';

// Legacy monitoring services (for backward compatibility)
export {
  monitoringDashboard,
  MonitoringDashboardService,
} from '../../domains/system-monitoring/services/monitoring-dashboard.service';
export {
  monitoringBootstrap,
  MonitoringBootstrapService,
} from '../../domains/system-monitoring/services/monitoring-bootstrap.service';

// Types and interfaces
export type {
  MetricLabels,
  BusinessMetricData,
  TechnicalMetricData,
} from './metrics.service';

export type {
  HealthCheckResult,
  HealthStatus,
  IHealthCheck,
} from './health-check.service';

export type {
  SystemMetrics,
  PerformanceAlert,
  PerformanceThresholds,
} from './performance-monitor';

export type {
  NotificationChannel,
  AlertNotification,
  Runbook,
  RunbookStep,
} from './alerting.service';

export type {
  DashboardMetrics,
  AlertSummary,
  SystemHealth,
  ObservabilityConfig,
} from './observability-dashboard';

// Legacy types (for backward compatibility)
export type {
  DashboardMetrics as LegacyDashboardMetrics,
  AlertRule,
  Alert,
} from '../../domains/system-monitoring/services/monitoring-dashboard.service';
