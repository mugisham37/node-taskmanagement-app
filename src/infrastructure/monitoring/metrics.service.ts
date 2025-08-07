import * as prometheus from 'prom-client';
import { EventEmitter } from 'events';

export interface MetricLabels {
  [key: string]: string | number;
}

export interface BusinessMetricData {
  name: string;
  value: number;
  labels?: MetricLabels;
  help?: string;
}

export interface TechnicalMetricData {
  name: string;
  value: number;
  labels?: MetricLabels;
  help?: string;
}

export class MetricsService extends EventEmitter {
  private readonly registry: prometheus.Registry;
  private readonly businessMetrics = new Map<
    string,
    prometheus.Histogram | prometheus.Counter | prometheus.Gauge
  >();
  private readonly technicalMetrics = new Map<
    string,
    prometheus.Histogram | prometheus.Counter | prometheus.Gauge
  >();

  // Pre-defined technical metrics
  private readonly httpRequestDuration: prometheus.Histogram;
  private readonly httpRequestsTotal: prometheus.Counter;
  private readonly activeConnections: prometheus.Gauge;
  private readonly databaseConnections: prometheus.Gauge;
  private readonly cacheHitRate: prometheus.Histogram;
  private readonly systemCpuUsage: prometheus.Gauge;
  private readonly systemMemoryUsage: prometheus.Gauge;
  private readonly errorRate: prometheus.Counter;
  private readonly businessOperations: prometheus.Counter;

  constructor() {
    super();

    // Create a custom registry
    this.registry = new prometheus.Registry();

    // Add default metrics (process metrics)
    prometheus.collectDefaultMetrics({
      register: this.registry,
      prefix: 'enterprise_platform_',
    });

    // Initialize technical metrics
    this.httpRequestDuration = new prometheus.Histogram({
      name: 'enterprise_platform_http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code', 'user_id', 'workspace_id'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
    });

    this.httpRequestsTotal = new prometheus.Counter({
      name: 'enterprise_platform_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'user_id', 'workspace_id'],
    });

    this.activeConnections = new prometheus.Gauge({
      name: 'enterprise_platform_active_connections',
      help: 'Number of active connections',
      labelNames: ['type'], // websocket, http, database
    });

    this.databaseConnections = new prometheus.Gauge({
      name: 'enterprise_platform_database_connections',
      help: 'Number of database connections',
      labelNames: ['state'], // active, idle, waiting
    });

    this.cacheHitRate = new prometheus.Histogram({
      name: 'enterprise_platform_cache_operations',
      help: 'Cache operation metrics',
      labelNames: ['operation', 'result'], // get/set/delete, hit/miss/error
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
    });

    this.systemCpuUsage = new prometheus.Gauge({
      name: 'enterprise_platform_system_cpu_usage_percent',
      help: 'System CPU usage percentage',
    });

    this.systemMemoryUsage = new prometheus.Gauge({
      name: 'enterprise_platform_system_memory_usage_percent',
      help: 'System memory usage percentage',
    });

    this.errorRate = new prometheus.Counter({
      name: 'enterprise_platform_errors_total',
      help: 'Total number of errors',
      labelNames: ['type', 'severity', 'component'],
    });

    this.businessOperations = new prometheus.Counter({
      name: 'enterprise_platform_business_operations_total',
      help: 'Total number of business operations',
      labelNames: ['operation', 'entity', 'user_id', 'workspace_id', 'result'],
    });

    // Register all metrics
    this.registry.registerMetric(this.httpRequestDuration);
    this.registry.registerMetric(this.httpRequestsTotal);
    this.registry.registerMetric(this.activeConnections);
    this.registry.registerMetric(this.databaseConnections);
    this.registry.registerMetric(this.cacheHitRate);
    this.registry.registerMetric(this.systemCpuUsage);
    this.registry.registerMetric(this.systemMemoryUsage);
    this.registry.registerMetric(this.errorRate);
    this.registry.registerMetric(this.businessOperations);
  }

  // HTTP Request Metrics
  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
    userId?: string,
    workspaceId?: string
  ): void {
    const labels = {
      method,
      route,
      status_code: statusCode.toString(),
      user_id: userId || 'anonymous',
      workspace_id: workspaceId || 'none',
    };

    this.httpRequestDuration.observe(labels, duration / 1000); // Convert to seconds
    this.httpRequestsTotal.inc(labels);
  }

  // Connection Metrics
  recordActiveConnection(
    type: 'websocket' | 'http' | 'database',
    count: number
  ): void {
    this.activeConnections.set({ type }, count);
  }

  recordDatabaseConnection(
    state: 'active' | 'idle' | 'waiting',
    count: number
  ): void {
    this.databaseConnections.set({ state }, count);
  }

  // Cache Metrics
  recordCacheOperation(
    operation: 'get' | 'set' | 'delete',
    result: 'hit' | 'miss' | 'error',
    duration: number
  ): void {
    this.cacheHitRate.observe({ operation, result }, duration / 1000);
  }

  // System Metrics
  recordSystemMetrics(cpuUsage: number, memoryUsage: number): void {
    this.systemCpuUsage.set(cpuUsage);
    this.systemMemoryUsage.set(memoryUsage);
  }

  // Error Metrics
  recordError(
    type: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    component: string
  ): void {
    this.errorRate.inc({ type, severity, component });
  }

  // Business Metrics
  recordBusinessOperation(
    operation: string,
    entity: string,
    result: 'success' | 'failure',
    userId?: string,
    workspaceId?: string
  ): void {
    this.businessOperations.inc({
      operation,
      entity,
      user_id: userId || 'system',
      workspace_id: workspaceId || 'none',
      result,
    });
  }

  // Dynamic Business Metrics
  recordBusinessMetric(data: BusinessMetricData): void {
    const metricName = `enterprise_platform_business_${data.name}`;
    let metric = this.businessMetrics.get(metricName);

    if (!metric) {
      // Create new histogram for business metrics
      metric = new prometheus.Histogram({
        name: metricName,
        help: data.help || `Business metric: ${data.name}`,
        labelNames: data.labels ? Object.keys(data.labels) : [],
        buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300],
      });

      this.businessMetrics.set(metricName, metric);
      this.registry.registerMetric(metric);
    }

    if (metric instanceof prometheus.Histogram) {
      metric.observe(data.labels || {}, data.value);
    }
  }

  // Dynamic Technical Metrics
  recordTechnicalMetric(data: TechnicalMetricData): void {
    const metricName = `enterprise_platform_technical_${data.name}`;
    let metric = this.technicalMetrics.get(metricName);

    if (!metric) {
      // Create new gauge for technical metrics
      metric = new prometheus.Gauge({
        name: metricName,
        help: data.help || `Technical metric: ${data.name}`,
        labelNames: data.labels ? Object.keys(data.labels) : [],
      });

      this.technicalMetrics.set(metricName, metric);
      this.registry.registerMetric(metric);
    }

    if (metric instanceof prometheus.Gauge) {
      metric.set(data.labels || {}, data.value);
    }
  }

  // User Action Tracking
  recordUserAction(
    action: string,
    userId: string,
    workspaceId?: string,
    metadata?: MetricLabels
  ): void {
    const userActions = this.getOrCreateCounter(
      'enterprise_platform_user_actions_total',
      'Total number of user actions',
      ['action', 'user_id', 'workspace_id', ...Object.keys(metadata || {})]
    );

    userActions.inc({
      action,
      user_id: userId,
      workspace_id: workspaceId || 'none',
      ...metadata,
    });
  }

  // System Event Tracking
  recordSystemEvent(event: string, metadata?: MetricLabels): void {
    const systemEvents = this.getOrCreateCounter(
      'enterprise_platform_system_events_total',
      'Total number of system events',
      ['event', ...Object.keys(metadata || {})]
    );

    systemEvents.inc({
      event,
      ...metadata,
    });
  }

  // Helper method to get or create counter
  private getOrCreateCounter(
    name: string,
    help: string,
    labelNames: string[]
  ): prometheus.Counter {
    let metric = this.technicalMetrics.get(name);

    if (!metric) {
      metric = new prometheus.Counter({
        name,
        help,
        labelNames,
      });

      this.technicalMetrics.set(name, metric);
      this.registry.registerMetric(metric);
    }

    return metric as prometheus.Counter;
  }

  // Get metrics for Prometheus scraping
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  // Get metrics in JSON format
  async getMetricsJSON(): Promise<any> {
    const metrics = await this.registry.getMetricsAsJSON();
    return metrics;
  }

  // Clear all metrics (useful for testing)
  clearMetrics(): void {
    this.registry.clear();
    this.businessMetrics.clear();
    this.technicalMetrics.clear();
  }

  // Get registry for custom use
  getRegistry(): prometheus.Registry {
    return this.registry;
  }
}

// Export singleton instance
export const metricsService = new MetricsService();
