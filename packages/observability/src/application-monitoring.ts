import { Counter, Gauge, Histogram, register } from 'prom-client';
import { Logger } from 'winston';
import { BusinessMetricsService } from './business-metrics-service';
import { ILoggingService } from './logging-service';
import { PerformanceMonitoringService } from './performance-monitoring';

export interface ApplicationHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, HealthCheck>;
  timestamp: Date;
  uptime: number;
  version: string;
}

export interface HealthCheck {
  status: 'pass' | 'fail' | 'warn';
  duration: number;
  message?: string;
  details?: Record<string, any>;
}

export interface ApplicationMetrics {
  // Application lifecycle
  applicationStartTime: Gauge<string>;
  applicationUptime: Gauge<string>;
  applicationRestarts: Counter<string>;
  
  // Error tracking
  errorsTotal: Counter<string>;
  errorRate: Gauge<string>;
  
  // Feature flags
  featureFlagUsage: Counter<string>;
  
  // WebSocket connections
  websocketConnections: Gauge<string>;
  websocketMessages: Counter<string>;
  
  // Background jobs
  jobsExecuted: Counter<string>;
  jobDuration: Histogram<string>;
  jobsQueued: Gauge<string>;
}

export interface MonitoringConfig {
  enabled: boolean;
  applicationName: string;
  version: string;
  environment: string;
  healthCheckInterval: number;
  errorThreshold: number;
  dependencies: string[];
}

export class ApplicationMonitoringService {
  private metrics: ApplicationMetrics;
  private logger: Logger;
  private config: MonitoringConfig;
  private healthChecks: Map<string, () => Promise<HealthCheck>> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;
  private startTime: Date;
  private errorCounts: Map<string, number> = new Map();

  constructor(
    private loggingService: ILoggingService,
    private businessMetrics: BusinessMetricsService,
    private performanceMonitoring: PerformanceMonitoringService,
    config: Partial<MonitoringConfig> = {}
  ) {
    this.config = {
      enabled: true,
      applicationName: 'taskmanagement',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      healthCheckInterval: 30000, // 30 seconds
      errorThreshold: 0.05, // 5%
      dependencies: ['database', 'cache', 'external-api'],
      ...config,
    };

    this.startTime = new Date();
    this.logger = this.loggingService.getLogger('ApplicationMonitoring');
    this.initializeMetrics();
    this.setupDefaultHealthChecks();
    this.startHealthChecking();
  }

  private initializeMetrics(): void {
    const prefix = 'taskmanagement_app';

    this.metrics = {
      // Application lifecycle
      applicationStartTime: new Gauge({
        name: `${prefix}_start_time_seconds`,
        help: 'Application start time in seconds since epoch',
        labelNames: ['version', 'environment'],
      }),

      applicationUptime: new Gauge({
        name: `${prefix}_uptime_seconds`,
        help: 'Application uptime in seconds',
        labelNames: ['version', 'environment'],
      }),

      applicationRestarts: new Counter({
        name: `${prefix}_restarts_total`,
        help: 'Total number of application restarts',
        labelNames: ['reason', 'version'],
      }),

      // Error tracking
      errorsTotal: new Counter({
        name: `${prefix}_errors_total`,
        help: 'Total number of application errors',
        labelNames: ['type', 'severity', 'component', 'environment'],
      }),

      errorRate: new Gauge({
        name: `${prefix}_error_rate`,
        help: 'Application error rate',
        labelNames: ['time_window', 'component'],
      }),

      // Feature flags
      featureFlagUsage: new Counter({
        name: `${prefix}_feature_flag_usage_total`,
        help: 'Feature flag usage count',
        labelNames: ['flag_name', 'enabled', 'user_segment'],
      }),

      // WebSocket connections
      websocketConnections: new Gauge({
        name: `${prefix}_websocket_connections`,
        help: 'Number of active WebSocket connections',
        labelNames: ['type'],
      }),

      websocketMessages: new Counter({
        name: `${prefix}_websocket_messages_total`,
        help: 'Total WebSocket messages',
        labelNames: ['type', 'direction'],
      }),

      // Background jobs
      jobsExecuted: new Counter({
        name: `${prefix}_jobs_executed_total`,
        help: 'Total number of background jobs executed',
        labelNames: ['job_type', 'status', 'queue'],
      }),

      jobDuration: new Histogram({
        name: `${prefix}_job_duration_seconds`,
        help: 'Background job execution duration',
        labelNames: ['job_type', 'queue'],
        buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 300],
      }),

      jobsQueued: new Gauge({
        name: `${prefix}_jobs_queued`,
        help: 'Number of jobs in queue',
        labelNames: ['queue', 'priority'],
      }),
    };

    // Register all metrics
    Object.values(this.metrics).forEach(metric => {
      register.registerMetric(metric);
    });

    // Set initial values
    this.metrics.applicationStartTime.set(
      { version: this.config.version, environment: this.config.environment },
      this.startTime.getTime() / 1000
    );

    this.logger.info('Application metrics initialized', {
      applicationName: this.config.applicationName,
      version: this.config.version,
      environment: this.config.environment,
    });
  }

  private setupDefaultHealthChecks(): void {
    // Database health check
    this.addHealthCheck('database', async () => {
      try {
        const start = Date.now();
        // This would be implemented based on your database connection
        // For now, we'll simulate a check
        await new Promise(resolve => setTimeout(resolve, 10));
        const duration = Date.now() - start;

        return {
          status: 'pass',
          duration,
          message: 'Database connection healthy',
          details: { connectionPool: 'active' },
        };
      } catch (error) {
        return {
          status: 'fail',
          duration: 0,
          message: 'Database connection failed',
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        };
      }
    });

    // Cache health check
    this.addHealthCheck('cache', async () => {
      try {
        const start = Date.now();
        // This would be implemented based on your cache connection
        await new Promise(resolve => setTimeout(resolve, 5));
        const duration = Date.now() - start;

        return {
          status: 'pass',
          duration,
          message: 'Cache connection healthy',
        };
      } catch (error) {
        return {
          status: 'fail',
          duration: 0,
          message: 'Cache connection failed',
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        };
      }
    });

    // Memory health check
    this.addHealthCheck('memory', async () => {
      const memUsage = process.memoryUsage();
      const heapUsedPercent = memUsage.heapUsed / memUsage.heapTotal;
      
      let status: 'pass' | 'warn' | 'fail' = 'pass';
      let message = 'Memory usage normal';

      if (heapUsedPercent > 0.9) {
        status = 'fail';
        message = 'Memory usage critical';
      } else if (heapUsedPercent > 0.8) {
        status = 'warn';
        message = 'Memory usage high';
      }

      return {
        status,
        duration: 1,
        message,
        details: {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          heapUsedPercent: Math.round(heapUsedPercent * 100),
        },
      };
    });
  }

  private startHealthChecking(): void {
    if (!this.config.enabled) return;

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
      this.updateUptimeMetric();
    }, this.config.healthCheckInterval);

    this.logger.info('Health checking started', {
      interval: this.config.healthCheckInterval,
      checks: Array.from(this.healthChecks.keys()),
    });
  }

  private async performHealthChecks(): Promise<void> {
    const checks: Record<string, HealthCheck> = {};

    for (const [name, checkFn] of this.healthChecks) {
      try {
        checks[name] = await checkFn();
      } catch (error) {
        checks[name] = {
          status: 'fail',
          duration: 0,
          message: 'Health check threw exception',
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        };
      }
    }

    // Log failed health checks
    Object.entries(checks).forEach(([name, check]) => {
      if (check.status === 'fail') {
        this.logger.error(`Health check failed: ${name}`, check);
      } else if (check.status === 'warn') {
        this.logger.warn(`Health check warning: ${name}`, check);
      }
    });
  }

  private updateUptimeMetric(): void {
    const uptime = (Date.now() - this.startTime.getTime()) / 1000;
    this.metrics.applicationUptime.set(
      { version: this.config.version, environment: this.config.environment },
      uptime
    );
  }

  // Public methods for tracking
  addHealthCheck(name: string, checkFn: () => Promise<HealthCheck>): void {
    this.healthChecks.set(name, checkFn);
    this.logger.info(`Health check added: ${name}`);
  }

  removeHealthCheck(name: string): void {
    this.healthChecks.delete(name);
    this.logger.info(`Health check removed: ${name}`);
  }

  async getApplicationHealth(): Promise<ApplicationHealth> {
    const checks: Record<string, HealthCheck> = {};
    
    for (const [name, checkFn] of this.healthChecks) {
      try {
        checks[name] = await checkFn();
      } catch (error) {
        checks[name] = {
          status: 'fail',
          duration: 0,
          message: 'Health check exception',
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        };
      }
    }

    // Determine overall status
    const failedChecks = Object.values(checks).filter(check => check.status === 'fail');
    const warnChecks = Object.values(checks).filter(check => check.status === 'warn');

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (failedChecks.length > 0) {
      status = 'unhealthy';
    } else if (warnChecks.length > 0) {
      status = 'degraded';
    }

    return {
      status,
      checks,
      timestamp: new Date(),
      uptime: (Date.now() - this.startTime.getTime()) / 1000,
      version: this.config.version,
    };
  }

  // Error tracking
  trackError(
    error: Error,
    type: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    component: string,
    context?: Record<string, any>
  ): void {
    if (!this.config.enabled) return;

    this.metrics.errorsTotal.inc({
      type,
      severity,
      component,
      environment: this.config.environment,
    });

    // Update error counts for rate calculation
    const key = `${component}:${type}`;
    this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);

    this.logger.error('Application error tracked', {
      error: error.message,
      stack: error.stack,
      type,
      severity,
      component,
      context,
    });

    // Track in business metrics if it's a user-facing error
    if (severity === 'high' || severity === 'critical') {
      // This could trigger alerts or notifications
    }
  }

  // Feature flag tracking
  trackFeatureFlag(flagName: string, enabled: boolean, userSegment: string = 'default'): void {
    if (!this.config.enabled) return;

    this.metrics.featureFlagUsage.inc({
      flag_name: flagName,
      enabled: enabled.toString(),
      user_segment: userSegment,
    });
  }

  // WebSocket tracking
  setWebSocketConnections(count: number, type: string = 'default'): void {
    if (!this.config.enabled) return;

    this.metrics.websocketConnections.set({ type }, count);
  }

  trackWebSocketMessage(type: string, direction: 'inbound' | 'outbound'): void {
    if (!this.config.enabled) return;

    this.metrics.websocketMessages.inc({ type, direction });
  }

  // Background job tracking
  trackJobExecution(
    jobType: string,
    status: 'success' | 'failure' | 'timeout',
    duration: number,
    queue: string = 'default'
  ): void {
    if (!this.config.enabled) return;

    this.metrics.jobsExecuted.inc({ job_type: jobType, status, queue });
    this.metrics.jobDuration.observe({ job_type: jobType, queue }, duration);
  }

  setJobsQueued(count: number, queue: string = 'default', priority: string = 'normal'): void {
    if (!this.config.enabled) return;

    this.metrics.jobsQueued.set({ queue, priority }, count);
  }

  // Application lifecycle
  trackRestart(reason: string): void {
    if (!this.config.enabled) return;

    this.metrics.applicationRestarts.inc({
      reason,
      version: this.config.version,
    });

    this.logger.warn('Application restart tracked', { reason, version: this.config.version });
  }

  // Utility methods
  getMetrics(): ApplicationMetrics {
    return this.metrics;
  }

  async getMetricsSnapshot(): Promise<Record<string, any>> {
    const snapshot: Record<string, any> = {};
    
    for (const [name, metric] of Object.entries(this.metrics)) {
      try {
        snapshot[name] = await metric.get();
      } catch (error) {
        this.logger.error(`Failed to get application metric snapshot for ${name}`, { error });
      }
    }

    return snapshot;
  }

  getConfig(): MonitoringConfig {
    return { ...this.config };
  }

  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    Object.values(this.metrics).forEach(metric => {
      register.removeSingleMetric(metric);
    });

    this.logger.info('Application monitoring service destroyed');
  }
}

export default ApplicationMonitoringService;