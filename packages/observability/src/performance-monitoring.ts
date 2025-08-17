import { Counter, Gauge, Histogram, register } from 'prom-client';
import { Logger } from 'winston';
import { ILoggingService } from './logging-service';

export interface PerformanceMetrics {
  // HTTP performance
  httpRequestDuration: Histogram<string>;
  httpRequestsTotal: Counter<string>;
  httpRequestSize: Histogram<string>;
  httpResponseSize: Histogram<string>;
  
  // Database performance
  databaseQueryDuration: Histogram<string>;
  databaseConnectionsActive: Gauge<string>;
  databaseConnectionsIdle: Gauge<string>;
  databaseQueryErrors: Counter<string>;
  
  // Cache performance
  cacheHitRate: Gauge<string>;
  cacheOperationDuration: Histogram<string>;
  cacheSize: Gauge<string>;
  
  // Memory and CPU
  memoryUsage: Gauge<string>;
  cpuUsage: Gauge<string>;
  gcDuration: Histogram<string>;
  
  // Application performance
  eventLoopLag: Histogram<string>;
  activeHandles: Gauge<string>;
  activeRequests: Gauge<string>;
}

export interface PerformanceAlert {
  metric: string;
  threshold: number;
  current: number;
  severity: 'warning' | 'critical';
  timestamp: Date;
  context?: Record<string, any>;
}

export interface PerformanceConfig {
  enabled: boolean;
  prefix: string;
  alertThresholds: {
    httpResponseTime: number;
    databaseQueryTime: number;
    memoryUsage: number;
    cpuUsage: number;
    errorRate: number;
  };
  samplingRate: number;
}

export class PerformanceMonitoringService {
  private metrics: PerformanceMetrics;
  private logger: Logger;
  private config: PerformanceConfig;
  private alertCallbacks: Array<(alert: PerformanceAlert) => void> = [];
  private monitoringInterval?: NodeJS.Timeout;

  constructor(
    private loggingService: ILoggingService,
    config: Partial<PerformanceConfig> = {}
  ) {
    this.config = {
      enabled: true,
      prefix: 'taskmanagement_perf',
      alertThresholds: {
        httpResponseTime: 1000, // 1 second
        databaseQueryTime: 500, // 500ms
        memoryUsage: 0.85, // 85%
        cpuUsage: 0.80, // 80%
        errorRate: 0.05, // 5%
      },
      samplingRate: 1.0, // 100% sampling
      ...config,
    };

    this.logger = this.loggingService.getLogger('PerformanceMonitoring');
    this.initializeMetrics();
    this.startSystemMonitoring();
  }

  private initializeMetrics(): void {
    const { prefix } = this.config;

    this.metrics = {
      // HTTP performance
      httpRequestDuration: new Histogram({
        name: `${prefix}_http_request_duration_seconds`,
        help: 'Duration of HTTP requests in seconds',
        labelNames: ['method', 'route', 'status_code', 'user_agent'],
        buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      }),

      httpRequestsTotal: new Counter({
        name: `${prefix}_http_requests_total`,
        help: 'Total number of HTTP requests',
        labelNames: ['method', 'route', 'status_code'],
      }),

      httpRequestSize: new Histogram({
        name: `${prefix}_http_request_size_bytes`,
        help: 'Size of HTTP requests in bytes',
        labelNames: ['method', 'route'],
        buckets: [100, 1000, 10000, 100000, 1000000],
      }),

      httpResponseSize: new Histogram({
        name: `${prefix}_http_response_size_bytes`,
        help: 'Size of HTTP responses in bytes',
        labelNames: ['method', 'route', 'status_code'],
        buckets: [100, 1000, 10000, 100000, 1000000],
      }),

      // Database performance
      databaseQueryDuration: new Histogram({
        name: `${prefix}_database_query_duration_seconds`,
        help: 'Duration of database queries in seconds',
        labelNames: ['operation', 'table', 'success'],
        buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      }),

      databaseConnectionsActive: new Gauge({
        name: `${prefix}_database_connections_active`,
        help: 'Number of active database connections',
        labelNames: ['pool'],
      }),

      databaseConnectionsIdle: new Gauge({
        name: `${prefix}_database_connections_idle`,
        help: 'Number of idle database connections',
        labelNames: ['pool'],
      }),

      databaseQueryErrors: new Counter({
        name: `${prefix}_database_query_errors_total`,
        help: 'Total number of database query errors',
        labelNames: ['operation', 'table', 'error_type'],
      }),

      // Cache performance
      cacheHitRate: new Gauge({
        name: `${prefix}_cache_hit_rate`,
        help: 'Cache hit rate percentage',
        labelNames: ['cache_type', 'key_pattern'],
      }),

      cacheOperationDuration: new Histogram({
        name: `${prefix}_cache_operation_duration_seconds`,
        help: 'Duration of cache operations in seconds',
        labelNames: ['operation', 'cache_type'],
        buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      }),

      cacheSize: new Gauge({
        name: `${prefix}_cache_size_bytes`,
        help: 'Size of cache in bytes',
        labelNames: ['cache_type'],
      }),

      // Memory and CPU
      memoryUsage: new Gauge({
        name: `${prefix}_memory_usage_bytes`,
        help: 'Memory usage in bytes',
        labelNames: ['type'],
      }),

      cpuUsage: new Gauge({
        name: `${prefix}_cpu_usage_percent`,
        help: 'CPU usage percentage',
        labelNames: ['core'],
      }),

      gcDuration: new Histogram({
        name: `${prefix}_gc_duration_seconds`,
        help: 'Garbage collection duration in seconds',
        labelNames: ['type'],
        buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      }),

      // Application performance
      eventLoopLag: new Histogram({
        name: `${prefix}_event_loop_lag_seconds`,
        help: 'Event loop lag in seconds',
        buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      }),

      activeHandles: new Gauge({
        name: `${prefix}_active_handles`,
        help: 'Number of active handles',
      }),

      activeRequests: new Gauge({
        name: `${prefix}_active_requests`,
        help: 'Number of active requests',
      }),
    };

    // Register all metrics
    Object.values(this.metrics).forEach(metric => {
      register.registerMetric(metric);
    });

    this.logger.info('Performance metrics initialized', {
      metricsCount: Object.keys(this.metrics).length,
      prefix: this.config.prefix,
    });
  }

  private startSystemMonitoring(): void {
    if (!this.config.enabled) return;

    // Monitor system metrics every 5 seconds
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 5000);

    // Monitor event loop lag
    this.monitorEventLoopLag();

    // Monitor garbage collection
    this.monitorGarbageCollection();

    this.logger.info('System monitoring started');
  }

  private collectSystemMetrics(): void {
    try {
      // Memory usage
      const memUsage = process.memoryUsage();
      this.metrics.memoryUsage.set({ type: 'rss' }, memUsage.rss);
      this.metrics.memoryUsage.set({ type: 'heapTotal' }, memUsage.heapTotal);
      this.metrics.memoryUsage.set({ type: 'heapUsed' }, memUsage.heapUsed);
      this.metrics.memoryUsage.set({ type: 'external' }, memUsage.external);

      // CPU usage
      const cpuUsage = process.cpuUsage();
      this.metrics.cpuUsage.set({ core: 'user' }, cpuUsage.user / 1000000); // Convert to seconds
      this.metrics.cpuUsage.set({ core: 'system' }, cpuUsage.system / 1000000);

      // Active handles and requests
      // @ts-ignore - Node.js internal API
      const handles = process._getActiveHandles?.()?.length || 0;
      // @ts-ignore - Node.js internal API
      const requests = process._getActiveRequests?.()?.length || 0;
      
      this.metrics.activeHandles.set(handles);
      this.metrics.activeRequests.set(requests);

      // Check for performance alerts
      this.checkPerformanceAlerts(memUsage, cpuUsage);
    } catch (error) {
      this.logger.error('Failed to collect system metrics', { error });
    }
  }

  private monitorEventLoopLag(): void {
    let start = process.hrtime.bigint();
    
    const measureLag = () => {
      const delta = process.hrtime.bigint() - start;
      const lag = Number(delta) / 1e9; // Convert to seconds
      
      this.metrics.eventLoopLag.observe(lag);
      
      start = process.hrtime.bigint();
      setImmediate(measureLag);
    };

    setImmediate(measureLag);
  }

  private monitorGarbageCollection(): void {
    if (global.gc) {
      const originalGc = global.gc;
      global.gc = (...args: any[]) => {
        const start = process.hrtime.bigint();
        const result = originalGc.apply(global, args);
        const duration = Number(process.hrtime.bigint() - start) / 1e9;
        
        this.metrics.gcDuration.observe({ type: 'manual' }, duration);
        
        return result;
      };
    }
  }

  private checkPerformanceAlerts(memUsage: NodeJS.MemoryUsage, cpuUsage: NodeJS.CpuUsage): void {
    const { alertThresholds } = this.config;

    // Memory usage alert
    const memoryUsagePercent = memUsage.heapUsed / memUsage.heapTotal;
    if (memoryUsagePercent > alertThresholds.memoryUsage) {
      this.triggerAlert({
        metric: 'memory_usage',
        threshold: alertThresholds.memoryUsage,
        current: memoryUsagePercent,
        severity: memoryUsagePercent > 0.95 ? 'critical' : 'warning',
        timestamp: new Date(),
        context: { memUsage },
      });
    }
  }

  // HTTP performance tracking
  trackHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
    requestSize?: number,
    responseSize?: number,
    userAgent?: string
  ): void {
    if (!this.config.enabled || Math.random() > this.config.samplingRate) return;

    const labels = { method, route, status_code: statusCode.toString() };

    this.metrics.httpRequestsTotal.inc(labels);
    this.metrics.httpRequestDuration.observe(
      { ...labels, user_agent: userAgent || 'unknown' },
      duration
    );

    if (requestSize !== undefined) {
      this.metrics.httpRequestSize.observe({ method, route }, requestSize);
    }

    if (responseSize !== undefined) {
      this.metrics.httpResponseSize.observe(labels, responseSize);
    }

    // Check for slow requests
    if (duration > this.config.alertThresholds.httpResponseTime / 1000) {
      this.triggerAlert({
        metric: 'http_response_time',
        threshold: this.config.alertThresholds.httpResponseTime,
        current: duration * 1000,
        severity: duration > 5 ? 'critical' : 'warning',
        timestamp: new Date(),
        context: { method, route, statusCode, duration },
      });
    }
  }

  // Database performance tracking
  trackDatabaseQuery(
    operation: string,
    table: string,
    duration: number,
    success: boolean,
    errorType?: string
  ): void {
    if (!this.config.enabled) return;

    this.metrics.databaseQueryDuration.observe(
      { operation, table, success: success.toString() },
      duration
    );

    if (!success && errorType) {
      this.metrics.databaseQueryErrors.inc({ operation, table, error_type: errorType });
    }

    // Check for slow queries
    if (duration > this.config.alertThresholds.databaseQueryTime / 1000) {
      this.triggerAlert({
        metric: 'database_query_time',
        threshold: this.config.alertThresholds.databaseQueryTime,
        current: duration * 1000,
        severity: duration > 2 ? 'critical' : 'warning',
        timestamp: new Date(),
        context: { operation, table, duration, success },
      });
    }
  }

  setDatabaseConnections(active: number, idle: number, pool: string = 'default'): void {
    if (!this.config.enabled) return;

    this.metrics.databaseConnectionsActive.set({ pool }, active);
    this.metrics.databaseConnectionsIdle.set({ pool }, idle);
  }

  // Cache performance tracking
  trackCacheOperation(
    operation: string,
    cacheType: string,
    duration: number,
    hit?: boolean,
    keyPattern?: string
  ): void {
    if (!this.config.enabled) return;

    this.metrics.cacheOperationDuration.observe({ operation, cache_type: cacheType }, duration);

    if (hit !== undefined && keyPattern) {
      // Update hit rate (this is a simplified calculation)
      const currentRate = hit ? 1 : 0;
      this.metrics.cacheHitRate.set({ cache_type: cacheType, key_pattern: keyPattern }, currentRate);
    }
  }

  setCacheSize(size: number, cacheType: string): void {
    if (!this.config.enabled) return;

    this.metrics.cacheSize.set({ cache_type: cacheType }, size);
  }

  // Alert management
  onAlert(callback: (alert: PerformanceAlert) => void): void {
    this.alertCallbacks.push(callback);
  }

  private triggerAlert(alert: PerformanceAlert): void {
    this.logger.warn('Performance alert triggered', alert);

    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        this.logger.error('Error in alert callback', { error });
      }
    });
  }

  // Utility methods
  getMetrics(): PerformanceMetrics {
    return this.metrics;
  }

  async getPerformanceSnapshot(): Promise<Record<string, any>> {
    const snapshot: Record<string, any> = {};
    
    for (const [name, metric] of Object.entries(this.metrics)) {
      try {
        snapshot[name] = await metric.get();
      } catch (error) {
        this.logger.error(`Failed to get performance metric snapshot for ${name}`, { error });
      }
    }

    return snapshot;
  }

  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    Object.values(this.metrics).forEach(metric => {
      register.removeSingleMetric(metric);
    });

    this.logger.info('Performance monitoring service destroyed');
  }
}

export default PerformanceMonitoringService;