import { APIPerformanceMonitor } from './api-performance-monitor';
import { MetricsService, MetricsConfig } from './metrics-service';
import {
  HealthService,
  HealthCheckConfig,
  HealthCheckResult,
  SystemHealth,
  HealthCheckFunction,
} from './health-service';
import { LoggingService, LoggingConfig, LogContext } from './logging-service';
import {
  DistributedTracingService,
  TraceContext,
  SpanOptions,
} from './distributed-tracing-service';
import {
  CorrelationIdService,
  CorrelationContext,
} from './correlation-id-service';
import {
  AlertingService,
  AlertingConfig,
  Alert,
  AlertRule,
} from './alerting-service';
import { InfrastructureError } from '../../shared/errors/infrastructure-error';

export interface SystemHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  services: ServiceHealthStatus[];
  metrics: SystemMetrics;
  alerts: Alert[];
}

export interface ServiceHealthStatus {
  name: string;
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  lastCheck: Date;
  details?: any;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
  };
  application: {
    uptime: number;
    requestsPerSecond: number;
    averageResponseTime: number;
    errorRate: number;
  };
}

export interface Alert {
  id: string;
  type: 'PERFORMANCE' | 'ERROR' | 'RESOURCE' | 'SECURITY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  source: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata?: any;
}

export interface MonitoringConfig {
  healthCheckInterval: number;
  metricsCollectionInterval: number;
  alertThresholds: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    responseTime: number;
    errorRate: number;
  };
  enableDistributedTracing: boolean;
  enableBusinessMetrics: boolean;
  enableCorrelationIds: boolean;
  enableAlerting: boolean;
  retentionPeriod: number; // days
}

export class ComprehensiveMonitoring {
  private alerts: Alert[] = [];
  private healthChecks: Map<string, ServiceHealthStatus> = new Map();
  private systemMetrics: SystemMetrics | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;

  // Integrated services
  private apiMonitor: APIPerformanceMonitor;
  private metricsService: MetricsService;
  private healthService: HealthService;
  private loggingService: LoggingService;
  private tracingService: DistributedTracingService;
  private correlationService: CorrelationIdService;
  private alertingService: AlertingService;

  constructor(
    private readonly config: MonitoringConfig,
    private readonly loggingConfig: LoggingConfig,
    private readonly metricsConfig: MetricsConfig,
    private readonly healthConfig: HealthCheckConfig,
    private readonly alertingConfig: AlertingConfig,
    private readonly appVersion: string = '1.0.0',
    private readonly environment: string = 'development'
  ) {
    // Initialize integrated services
    this.loggingService = new LoggingService(loggingConfig);
    this.metricsService = new MetricsService(metricsConfig);
    this.healthService = new HealthService(
      healthConfig,
      appVersion,
      environment
    );
    this.apiMonitor = new APIPerformanceMonitor();

    // Initialize new services
    this.correlationService = new CorrelationIdService();
    this.tracingService = new DistributedTracingService(
      this.loggingService,
      this.metricsService
    );
    this.alertingService = new AlertingService(
      alertingConfig,
      this.loggingService,
      this.metricsService
    );

    this.setupEventHandlers();
    this.startMonitoring();
  }

  /**
   * Setup event handlers for integrated services
   */
  private setupEventHandlers(): void {
    // Listen to alerting events
    this.alertingService.on('alert', (alert: Alert) => {
      this.loggingService.warn('Alert triggered', {
        alertId: alert.id,
        severity: alert.severity,
        message: alert.message,
        correlationId: this.getCurrentCorrelationId(),
      });

      // Record alert in metrics
      this.metricsService.incrementCounter('monitoring_alerts_total', {
        severity: alert.severity,
        rule: alert.ruleName,
      });
    });

    this.alertingService.on('alertResolved', (alert: Alert) => {
      this.loggingService.info('Alert resolved', {
        alertId: alert.id,
        severity: alert.severity,
        correlationId: this.getCurrentCorrelationId(),
      });
    });
  }

  /**
   * Start comprehensive monitoring
   */
  startMonitoring(): void {
    this.loggingService.info('Starting comprehensive monitoring system', {
      correlationId: this.getCurrentCorrelationId(),
    });

    // Register default health checks
    this.registerDefaultHealthChecks();

    // Start periodic health checks
    this.monitoringInterval = setInterval(async () => {
      await this.performHealthChecks();
      await this.collectSystemMetrics();
      await this.checkAlertThresholds();
      await this.updateAlertingMetrics();
    }, this.config.healthCheckInterval);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.loggingService.info('Comprehensive monitoring stopped');
  }

  // ===== LOGGING SERVICE METHODS =====

  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext): void {
    this.loggingService.debug(message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    this.loggingService.info(message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    this.loggingService.warn(message, context);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: LogContext): void {
    this.loggingService.error(message, error, context);
  }

  /**
   * Start performance tracking
   */
  startPerformanceTracking(operationId: string, context?: LogContext): void {
    this.loggingService.startPerformanceTracking(operationId, context);
  }

  /**
   * End performance tracking
   */
  endPerformanceTracking(operationId: string, context?: LogContext): void {
    this.loggingService.endPerformanceTracking(operationId, context);
  }

  // ===== METRICS SERVICE METHODS =====

  /**
   * Increment a counter metric
   */
  incrementCounter(
    name: string,
    labels?: Record<string, string>,
    value: number = 1
  ): void {
    this.metricsService.incrementCounter(name, labels, value);
  }

  /**
   * Record histogram value
   */
  recordHistogram(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void {
    this.metricsService.observeHistogram(name, value, labels);
  }

  /**
   * Set gauge value
   */
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    this.metricsService.setGauge(name, value, labels);
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return this.metricsService.getMetrics();
  }

  // ===== HEALTH SERVICE METHODS =====

  /**
   * Register a health check
   */
  registerHealthCheck(name: string, checkFn: HealthCheckFunction): void {
    this.healthService.registerHealthCheck(name, checkFn);
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<SystemHealth> {
    return this.healthService.checkHealth();
  }

  // ===== DISTRIBUTED TRACING METHODS =====

  /**
   * Start a new trace span
   */
  startSpan(options: SpanOptions): TraceContext {
    return this.tracingService.startSpan(options);
  }

  /**
   * Finish a trace span
   */
  finishSpan(span: TraceContext, error?: Error): void {
    this.tracingService.finishSpan(span, error);
  }

  /**
   * Run function with trace span
   */
  async runWithSpan<T>(
    options: SpanOptions,
    fn: (span: TraceContext) => Promise<T>
  ): Promise<T> {
    return this.tracingService.runWithSpan(options, fn);
  }

  /**
   * Get current trace span
   */
  getCurrentSpan(): TraceContext | undefined {
    return this.tracingService.getCurrentSpan();
  }

  /**
   * Get trace statistics
   */
  getTraceStatistics() {
    return this.tracingService.getTraceStatistics();
  }

  // ===== CORRELATION ID METHODS =====

  /**
   * Get current correlation context
   */
  getCurrentCorrelationContext(): CorrelationContext | undefined {
    return this.correlationService.getCurrentContext();
  }

  /**
   * Get current correlation ID
   */
  getCurrentCorrelationId(): string | undefined {
    return this.correlationService.getCurrentCorrelationId();
  }

  /**
   * Get correlation middleware
   */
  getCorrelationMiddleware() {
    return this.correlationService.middleware();
  }

  /**
   * Get correlation headers for outgoing requests
   */
  getCorrelationHeaders(): Record<string, string> {
    return this.correlationService.getCorrelationHeaders();
  }

  // ===== ALERTING METHODS =====

  /**
   * Add alert rule
   */
  addAlertRule(
    rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>
  ): AlertRule {
    return this.alertingService.addRule(rule);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return this.alertingService.getActiveAlerts();
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string, resolvedBy?: string): boolean {
    return this.alertingService.resolveAlert(alertId, resolvedBy);
  }

  /**
   * Record metric value for alerting
   */
  recordMetricForAlerting(metric: string, value: number): void {
    this.alertingService.recordMetricValue(metric, value);
  }

  /**
   * Get alert statistics
   */
  getAlertStatistics() {
    return this.alertingService.getAlertStatistics();
  }

  // ===== COMPREHENSIVE MONITORING METHODS =====

  /**
   * Get comprehensive system status
   */
  async getSystemStatus(): Promise<SystemHealthStatus> {
    const health = await this.healthService.checkHealth();
    const services = Array.from(this.healthChecks.values());
    const metrics = await this.collectSystemMetrics();
    const activeAlerts = this.alerts.filter(alert => !alert.resolved);

    return {
      status: health.status,
      timestamp: new Date(),
      services,
      metrics,
      alerts: activeAlerts,
    };
  }

  /**
   * Create an alert
   */
  createAlert(
    type: Alert['type'],
    severity: Alert['severity'],
    message: string,
    source: string,
    metadata?: any
  ): Alert {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      message,
      source,
      timestamp: new Date(),
      resolved: false,
      metadata,
    };

    this.alerts.push(alert);
    this.loggingService.warn(`Alert created: ${message}`, {
      alertId: alert.id,
      type,
      severity,
      source,
    });

    return alert;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      this.loggingService.info(`Alert resolved: ${alert.message}`, {
        alertId,
      });
      return true;
    }
    return false;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Register default health checks
   */
  private registerDefaultHealthChecks(): void {
    // Memory health check
    this.healthService.registerHealthCheck(
      'memory',
      async (): Promise<HealthCheckResult> => {
        const startTime = Date.now();
        const memUsage = process.memoryUsage();
        const memoryUsagePercent =
          (memUsage.heapUsed / memUsage.heapTotal) * 100;

        return {
          name: 'memory',
          status:
            memoryUsagePercent > 90
              ? 'unhealthy'
              : memoryUsagePercent > 70
                ? 'degraded'
                : 'healthy',
          message: `Memory usage: ${memoryUsagePercent.toFixed(2)}%`,
          timestamp: new Date(),
          duration: Date.now() - startTime,
          metadata: { memoryUsage: memUsage, usagePercent: memoryUsagePercent },
        };
      }
    );

    // CPU health check
    this.healthService.registerHealthCheck(
      'cpu',
      async (): Promise<HealthCheckResult> => {
        const startTime = Date.now();
        const cpuUsage = process.cpuUsage();
        const totalUsage = cpuUsage.user + cpuUsage.system;

        return {
          name: 'cpu',
          status: 'healthy', // Simplified for now
          message: `CPU usage tracked`,
          timestamp: new Date(),
          duration: Date.now() - startTime,
          metadata: { cpuUsage, totalUsage },
        };
      }
    );
  }

  /**
   * Perform health checks
   */
  private async performHealthChecks(): Promise<void> {
    try {
      const health = await this.healthService.checkHealth();

      // Update service health status
      for (const check of health.checks) {
        this.healthChecks.set(check.name, {
          name: check.name,
          status:
            check.status === 'healthy'
              ? 'up'
              : check.status === 'degraded'
                ? 'degraded'
                : 'down',
          responseTime: check.duration,
          lastCheck: check.timestamp,
          details: check.metadata,
        });
      }
    } catch (error) {
      this.loggingService.error('Health check failed', error as Error);
    }
  }

  /**
   * Collect system metrics
   */
  private async collectSystemMetrics(): Promise<SystemMetrics> {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const metrics: SystemMetrics = {
      cpu: {
        usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
        loadAverage: [0, 0, 0], // Not available in Node.js on Windows
      },
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      },
      disk: {
        used: 0, // Would need additional library to get disk usage
        total: 0,
        percentage: 0,
      },
      network: {
        bytesIn: 0, // Would need additional monitoring
        bytesOut: 0,
      },
      application: {
        uptime: process.uptime(),
        requestsPerSecond: 0, // Would be calculated from metrics
        averageResponseTime: 0, // Would be calculated from metrics
        errorRate: 0, // Would be calculated from metrics
      },
    };

    this.systemMetrics = metrics;
    return metrics;
  }

  /**
   * Check alert thresholds
   */
  private async checkAlertThresholds(): Promise<void> {
    if (!this.systemMetrics) return;

    const { alertThresholds } = this.config;

    // Check memory usage
    if (this.systemMetrics.memory.percentage > alertThresholds.memoryUsage) {
      this.createAlert(
        'RESOURCE',
        this.systemMetrics.memory.percentage > 90 ? 'CRITICAL' : 'HIGH',
        `High memory usage: ${this.systemMetrics.memory.percentage.toFixed(2)}%`,
        'system-monitor'
      );
    }

    // Check CPU usage (simplified)
    if (this.systemMetrics.cpu.usage > alertThresholds.cpuUsage) {
      this.createAlert(
        'RESOURCE',
        'HIGH',
        `High CPU usage detected`,
        'system-monitor'
      );
    }

    // Check response time
    if (
      this.systemMetrics.application.averageResponseTime >
      alertThresholds.responseTime
    ) {
      this.createAlert(
        'PERFORMANCE',
        'HIGH',
        `High average response time: ${this.systemMetrics.application.averageResponseTime.toFixed(2)}ms`,
        'system-monitor'
      );
    }

    // Check error rate
    if (this.systemMetrics.application.errorRate > alertThresholds.errorRate) {
      this.createAlert(
        'ERROR',
        'CRITICAL',
        `High error rate: ${this.systemMetrics.application.errorRate.toFixed(2)}%`,
        'system-monitor'
      );
    }
  }

  /**
   * Update alerting metrics
   */
  private async updateAlertingMetrics(): Promise<void> {
    // Record system metrics for alerting
    if (this.systemMetrics) {
      this.alertingService.recordMetricValue(
        'memory_usage_percentage',
        this.systemMetrics.memory.percentage
      );
      this.alertingService.recordMetricValue(
        'cpu_usage',
        this.systemMetrics.cpu.usage
      );
      this.alertingService.recordMetricValue(
        'response_time_ms',
        this.systemMetrics.application.averageResponseTime
      );
      this.alertingService.recordMetricValue(
        'error_rate_percentage',
        this.systemMetrics.application.errorRate
      );
      this.alertingService.recordMetricValue(
        'requests_per_second',
        this.systemMetrics.application.requestsPerSecond
      );
    }

    // Record health check metrics
    for (const [name, status] of this.healthChecks) {
      const healthValue =
        status.status === 'up' ? 1 : status.status === 'degraded' ? 0.5 : 0;
      this.alertingService.recordMetricValue(
        `health_check_${name}`,
        healthValue
      );
    }

    // Record alert statistics
    const alertStats = this.alertingService.getAlertStatistics();
    this.metricsService.setGauge('alerts_active_total', alertStats.active);
    this.metricsService.setGauge('alerts_resolved_total', alertStats.resolved);

    // Record alerts by severity
    Object.entries(alertStats.bySeverity).forEach(([severity, count]) => {
      this.metricsService.setGauge('alerts_by_severity', count, {
        severity: severity.toLowerCase(),
      });
    });
  }
}
