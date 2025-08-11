import {
  register,
  Counter,
  Histogram,
  Gauge,
  Summary,
  collectDefaultMetrics,
} from 'prom-client';
import { InfrastructureError } from '../../shared/errors/infrastructure-error';

export interface MetricsConfig {
  enableDefaultMetrics: boolean;
  defaultMetricsInterval: number;
  prefix: string;
  labels: Record<string, string>;
}

export interface CustomMetricConfig {
  name: string;
  help: string;
  labels?: string[];
  buckets?: number[];
  percentiles?: number[];
}

/**
 * Metrics Service
 *
 * Provides application metrics collection and reporting functionality
 */
export class MetricsService {
  private counters = new Map<string, Counter>();
  private histograms = new Map<string, Histogram>();
  private gauges = new Map<string, Gauge>();
  private summaries = new Map<string, Summary>();

  constructor(private readonly config: MetricsConfig) {
    this.initialize();
  }

  /**
   * Initialize metrics collection
   */
  private initialize(): void {
    // Clear existing metrics
    register.clear();

    // Enable default metrics if configured
    if (this.config.enableDefaultMetrics) {
      collectDefaultMetrics({
        prefix: this.config.prefix,
        labels: this.config.labels,
      });
    }

    // Create application-specific metrics
    this.createApplicationMetrics();
  }

  /**
   * Create application-specific metrics
   */
  private createApplicationMetrics(): void {
    // HTTP request metrics
    this.createCounter('http_requests_total', 'Total number of HTTP requests', [
      'method',
      'route',
      'status_code',
    ]);
    this.createHistogram(
      'http_request_duration_seconds',
      'HTTP request duration in seconds',
      ['method', 'route'],
      [0.1, 0.5, 1, 2, 5, 10]
    );

    // Database metrics
    this.createCounter(
      'database_operations_total',
      'Total number of database operations',
      ['operation', 'table', 'status']
    );
    this.createHistogram(
      'database_operation_duration_seconds',
      'Database operation duration in seconds',
      ['operation', 'table'],
      [0.01, 0.05, 0.1, 0.5, 1, 2]
    );

    // Authentication metrics
    this.createCounter(
      'auth_attempts_total',
      'Total number of authentication attempts',
      ['type', 'status']
    );
    this.createCounter(
      'auth_tokens_issued_total',
      'Total number of authentication tokens issued',
      ['type']
    );

    // Business metrics
    this.createCounter('tasks_total', 'Total number of tasks', [
      'status',
      'priority',
    ]);
    this.createCounter('projects_total', 'Total number of projects', [
      'status',
    ]);
    this.createCounter('users_total', 'Total number of users', ['status']);

    // Cache metrics
    this.createCounter(
      'cache_operations_total',
      'Total number of cache operations',
      ['operation', 'status']
    );
    this.createHistogram(
      'cache_operation_duration_seconds',
      'Cache operation duration in seconds',
      ['operation'],
      [0.001, 0.005, 0.01, 0.05, 0.1]
    );

    // Email metrics
    this.createCounter('emails_sent_total', 'Total number of emails sent', [
      'type',
      'status',
    ]);
    this.createGauge('email_queue_size', 'Current size of email queue');

    // Rate limiting metrics
    this.createCounter(
      'rate_limit_exceeded_total',
      'Total number of rate limit violations',
      ['action', 'identifier_type']
    );

    // Error metrics
    this.createCounter('errors_total', 'Total number of errors', [
      'type',
      'severity',
    ]);

    // WebSocket metrics
    this.createGauge(
      'websocket_connections_active',
      'Number of active WebSocket connections'
    );
    this.createCounter(
      'websocket_messages_total',
      'Total number of WebSocket messages',
      ['type', 'direction']
    );

    // Performance metrics
    this.createHistogram(
      'operation_duration_seconds',
      'Operation duration in seconds',
      ['operation'],
      [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
    );
    this.createGauge('memory_usage_bytes', 'Memory usage in bytes', ['type']);
  }

  /**
   * Create a counter metric
   */
  createCounter(name: string, help: string, labels: string[] = []): Counter {
    const fullName = `${this.config.prefix}${name}`;

    if (this.counters.has(fullName)) {
      return this.counters.get(fullName)!;
    }

    const counter = new Counter({
      name: fullName,
      help,
      labelNames: [...labels, ...Object.keys(this.config.labels)],
    });

    this.counters.set(fullName, counter);
    return counter;
  }

  /**
   * Create a histogram metric
   */
  createHistogram(
    name: string,
    help: string,
    labels: string[] = [],
    buckets?: number[]
  ): Histogram {
    const fullName = `${this.config.prefix}${name}`;

    if (this.histograms.has(fullName)) {
      return this.histograms.get(fullName)!;
    }

    const config: any = {
      name: fullName,
      help,
      labelNames: [...labels, ...Object.keys(this.config.labels)],
    };

    if (buckets !== undefined) {
      config.buckets = buckets;
    }

    const histogram = new Histogram(config);

    this.histograms.set(fullName, histogram);
    return histogram;
  }

  /**
   * Create a gauge metric
   */
  createGauge(name: string, help: string, labels: string[] = []): Gauge {
    const fullName = `${this.config.prefix}${name}`;

    if (this.gauges.has(fullName)) {
      return this.gauges.get(fullName)!;
    }

    const gauge = new Gauge({
      name: fullName,
      help,
      labelNames: [...labels, ...Object.keys(this.config.labels)],
    });

    this.gauges.set(fullName, gauge);
    return gauge;
  }

  /**
   * Create a summary metric
   */
  createSummary(
    name: string,
    help: string,
    labels: string[] = [],
    percentiles?: number[]
  ): Summary {
    const fullName = `${this.config.prefix}${name}`;

    if (this.summaries.has(fullName)) {
      return this.summaries.get(fullName)!;
    }

    const config: any = {
      name: fullName,
      help,
      labelNames: [...labels, ...Object.keys(this.config.labels)],
    };

    if (percentiles !== undefined) {
      config.percentiles = percentiles;
    }

    const summary = new Summary(config);

    this.summaries.set(fullName, summary);
    return summary;
  }

  /**
   * Increment a counter
   */
  incrementCounter(
    name: string,
    labels: Record<string, string> = {},
    value: number = 1
  ): void {
    const counter = this.getCounter(name);
    if (counter) {
      counter.inc({ ...this.config.labels, ...labels }, value);
    }
  }

  /**
   * Observe a histogram value
   */
  observeHistogram(
    name: string,
    value: number,
    labels: Record<string, string> = {}
  ): void {
    const histogram = this.getHistogram(name);
    if (histogram) {
      histogram.observe({ ...this.config.labels, ...labels }, value);
    }
  }

  /**
   * Set a gauge value
   */
  setGauge(
    name: string,
    value: number,
    labels: Record<string, string> = {}
  ): void {
    const gauge = this.getGauge(name);
    if (gauge) {
      gauge.set({ ...this.config.labels, ...labels }, value);
    }
  }

  /**
   * Increment a gauge value
   */
  incrementGauge(
    name: string,
    labels: Record<string, string> = {},
    value: number = 1
  ): void {
    const gauge = this.getGauge(name);
    if (gauge) {
      gauge.inc({ ...this.config.labels, ...labels }, value);
    }
  }

  /**
   * Decrement a gauge value
   */
  decrementGauge(
    name: string,
    labels: Record<string, string> = {},
    value: number = 1
  ): void {
    const gauge = this.getGauge(name);
    if (gauge) {
      gauge.dec({ ...this.config.labels, ...labels }, value);
    }
  }

  /**
   * Observe a summary value
   */
  observeSummary(
    name: string,
    value: number,
    labels: Record<string, string> = {}
  ): void {
    const summary = this.getSummary(name);
    if (summary) {
      summary.observe({ ...this.config.labels, ...labels }, value);
    }
  }

  /**
   * Record HTTP request metrics
   */
  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number
  ): void {
    this.incrementCounter('http_requests_total', {
      method,
      route,
      status_code: statusCode.toString(),
    });
    this.observeHistogram('http_request_duration_seconds', duration / 1000, {
      method,
      route,
    });
  }

  /**
   * Record database operation metrics
   */
  recordDatabaseOperation(
    operation: string,
    table: string,
    duration: number,
    success: boolean
  ): void {
    const status = success ? 'success' : 'error';
    this.incrementCounter('database_operations_total', {
      operation,
      table,
      status,
    });
    this.observeHistogram(
      'database_operation_duration_seconds',
      duration / 1000,
      { operation, table }
    );
  }

  /**
   * Record authentication metrics
   */
  recordAuthAttempt(
    type: 'login' | 'register' | 'refresh',
    success: boolean
  ): void {
    const status = success ? 'success' : 'failure';
    this.incrementCounter('auth_attempts_total', { type, status });

    if (success) {
      this.incrementCounter('auth_tokens_issued_total', { type });
    }
  }

  /**
   * Record business metrics
   */
  recordTaskCreated(status: string, priority: string): void {
    this.incrementCounter('tasks_total', { status, priority });
  }

  recordProjectCreated(status: string): void {
    this.incrementCounter('projects_total', { status });
  }

  recordUserRegistered(status: string): void {
    this.incrementCounter('users_total', { status });
  }

  /**
   * Record cache operation metrics
   */
  recordCacheOperation(
    operation: 'get' | 'set' | 'del' | 'hit' | 'miss',
    duration?: number
  ): void {
    const status =
      operation === 'hit' || operation === 'miss' ? operation : 'success';
    this.incrementCounter('cache_operations_total', { operation, status });

    if (duration !== undefined) {
      this.observeHistogram(
        'cache_operation_duration_seconds',
        duration / 1000,
        { operation }
      );
    }
  }

  /**
   * Record email metrics
   */
  recordEmailSent(type: string, success: boolean): void {
    const status = success ? 'success' : 'failure';
    this.incrementCounter('emails_sent_total', { type, status });
  }

  updateEmailQueueSize(size: number): void {
    this.setGauge('email_queue_size', size);
  }

  /**
   * Record rate limiting metrics
   */
  recordRateLimitExceeded(action: string, identifierType: 'user' | 'ip'): void {
    this.incrementCounter('rate_limit_exceeded_total', {
      action,
      identifier_type: identifierType,
    });
  }

  /**
   * Record error metrics
   */
  recordError(
    type: string,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): void {
    this.incrementCounter('errors_total', { type, severity });
  }

  /**
   * Record WebSocket metrics
   */
  updateWebSocketConnections(count: number): void {
    this.setGauge('websocket_connections_active', count);
  }

  recordWebSocketMessage(
    type: string,
    direction: 'inbound' | 'outbound'
  ): void {
    this.incrementCounter('websocket_messages_total', { type, direction });
  }

  /**
   * Record operation duration
   */
  recordOperationDuration(operation: string, duration: number): void {
    this.observeHistogram('operation_duration_seconds', duration / 1000, {
      operation,
    });
  }

  /**
   * Record histogram value (alias for observeHistogram for backward compatibility)
   */
  recordHistogram(
    name: string,
    value: number,
    labels: Record<string, string> = {}
  ): void {
    this.observeHistogram(name, value, labels);
  }

  /**
   * Update memory usage metrics
   */
  updateMemoryUsage(): void {
    const memUsage = process.memoryUsage();
    this.setGauge('memory_usage_bytes', memUsage.heapUsed, {
      type: 'heap_used',
    });
    this.setGauge('memory_usage_bytes', memUsage.heapTotal, {
      type: 'heap_total',
    });
    this.setGauge('memory_usage_bytes', memUsage.external, {
      type: 'external',
    });
    this.setGauge('memory_usage_bytes', memUsage.rss, { type: 'rss' });
  }

  /**
   * Record a generic metric (for backward compatibility)
   */
  async recordMetric(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): Promise<void> {
    // Try to determine metric type based on name patterns
    if (name.includes('_total') || name.includes('_count')) {
      this.incrementCounter(name, labels, value);
    } else if (
      name.includes('_duration') ||
      name.includes('_time') ||
      name.includes('_latency')
    ) {
      this.observeHistogram(name, value, labels);
    } else {
      this.setGauge(name, value, labels);
    }
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    try {
      // Update memory usage before returning metrics
      this.updateMemoryUsage();

      return await register.metrics();
    } catch (error) {
      throw new InfrastructureError(
        `Failed to get metrics: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get metrics as JSON
   */
  async getMetricsAsJSON(): Promise<any> {
    try {
      return await register.getMetricsAsJSON();
    } catch (error) {
      throw new InfrastructureError(
        `Failed to get metrics as JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    register.clear();
    this.counters.clear();
    this.histograms.clear();
    this.gauges.clear();
    this.summaries.clear();
  }

  /**
   * Get counter by name
   */
  private getCounter(name: string): Counter | undefined {
    const fullName = `${this.config.prefix}${name}`;
    return this.counters.get(fullName);
  }

  /**
   * Get histogram by name
   */
  private getHistogram(name: string): Histogram | undefined {
    const fullName = `${this.config.prefix}${name}`;
    return this.histograms.get(fullName);
  }

  /**
   * Get gauge by name
   */
  private getGauge(name: string): Gauge | undefined {
    const fullName = `${this.config.prefix}${name}`;
    return this.gauges.get(fullName);
  }

  /**
   * Get summary by name
   */
  private getSummary(name: string): Summary | undefined {
    const fullName = `${this.config.prefix}${name}`;
    return this.summaries.get(fullName);
  }

}
