// Monitoring Services
export { LoggingService } from './logging-service';
export type {
  LoggingConfig,
  LogContext,
  StructuredLog,
} from './logging-service';

export { MetricsService } from './metrics-service';
export type { MetricsConfig, CustomMetricConfig } from './metrics-service';

export { HealthService } from './health-service';
export type {
  HealthCheckConfig,
  HealthCheckResult,
  SystemHealth,
  HealthCheckFunction,
} from './health-service';

export { ErrorTrackingService } from './error-tracking';
export type {
  ErrorTrackingConfig,
  ErrorContext,
  TrackedError,
  ErrorSummary,
} from './error-tracking';

export { APIPerformanceMonitor } from './api-performance-monitor';
export type {
  APIPerformanceMetrics,
  EndpointStatistics,
  PerformanceAlert,
  PerformanceConfig,
} from './api-performance-monitor';

export { ComprehensiveMonitoring } from './comprehensive-monitoring';
export type {
  SystemHealthStatus,
  ServiceHealthStatus,
  SystemMetrics,
  Alert,
  MonitoringConfig,
} from './comprehensive-monitoring';

// Enhanced monitoring service that consolidates all monitoring capabilities
export { ComprehensiveMonitoring as MonitoringService } from './comprehensive-monitoring';

// Factory function to create monitoring services with default configurations
export function createMonitoringServices(config: {
  logging: Partial<LoggingConfig>;
  metrics: Partial<MetricsConfig>;
  health: Partial<HealthCheckConfig>;
  errorTracking: Partial<ErrorTrackingConfig>;
  appVersion: string;
  environment: string;
}) {
  // Default logging configuration
  const defaultLoggingConfig: LoggingConfig = {
    level: config.environment === 'production' ? 'info' : 'debug',
    format: config.environment === 'production' ? 'json' : 'combined',
    enableConsole: true,
    enableFile: config.environment === 'production',
    enableRotation: true,
    fileConfig: {
      filename: 'app.log',
      maxSize: '10m',
      maxFiles: '5',
      dirname: 'logs',
    },
    enableErrorFile: true,
    errorFileConfig: {
      filename: 'error.log',
      maxSize: '10m',
      maxFiles: '5',
      dirname: 'logs',
    },
    enableSyslog: false,
    metadata: {
      service: 'task-management-api',
      version: config.appVersion,
      environment: config.environment,
    },
    ...config.logging,
  };

  // Default metrics configuration
  const defaultMetricsConfig: MetricsConfig = {
    enableDefaultMetrics: true,
    defaultMetricsInterval: 10000,
    prefix: 'taskmanagement_',
    labels: {
      service: 'task-management-api',
      version: config.appVersion,
      environment: config.environment,
    },
    ...config.metrics,
  };

  // Default health check configuration
  const defaultHealthConfig: HealthCheckConfig = {
    timeout: 5000,
    retries: 3,
    interval: 30000,
    gracefulShutdownTimeout: 10000,
    ...config.health,
  };

  // Default error tracking configuration
  const defaultErrorTrackingConfig: ErrorTrackingConfig = {
    enableConsoleLogging: true,
    enableFileLogging: config.environment === 'production',
    enableExternalService: false,
    maxErrorsInMemory: 1000,
    errorRetentionDays: 7,
    alertThresholds: {
      errorRate: 10, // 10 errors per minute
      criticalErrorRate: 1, // 1 critical error per minute
    },
    ...config.errorTracking,
  };

  // Create services
  const loggingService = new LoggingService(defaultLoggingConfig);
  const metricsService = new MetricsService(defaultMetricsConfig);
  const healthService = new HealthService(
    defaultHealthConfig,
    config.appVersion,
    config.environment
  );
  const errorTrackingService = new ErrorTrackingService(
    defaultErrorTrackingConfig
  );

  // Setup error tracking integration with logging
  errorTrackingService.onError(error => {
    loggingService.error(`Tracked error: ${error.message}`, undefined, {
      errorId: error.id,
      fingerprint: error.fingerprint,
      count: error.count,
      level: error.level,
      ...error.context,
    });

    // Record error metrics
    metricsService.recordError(error.name, error.level as any);
  });

  return {
    logging: loggingService,
    metrics: metricsService,
    health: healthService,
    errorTracking: errorTrackingService,
  };
}

// Utility function to setup common health checks
export function setupCommonHealthChecks(
  healthService: HealthService,
  dependencies: {
    database?: () => Promise<boolean>;
    redis?: () => Promise<boolean>;
    externalServices?: Array<{ name: string; url: string }>;
  }
) {
  // Database health check
  if (dependencies.database) {
    const dbHealthCheck = healthService.createDatabaseHealthCheck(
      'database',
      dependencies.database
    );
    healthService.registerHealthCheck('database', dbHealthCheck);
  }

  // Redis health check
  if (dependencies.redis) {
    const redisHealthCheck = healthService.createRedisHealthCheck(
      'redis',
      dependencies.redis
    );
    healthService.registerHealthCheck('redis', redisHealthCheck);
  }

  // External services health checks
  if (dependencies.externalServices) {
    dependencies.externalServices.forEach(service => {
      const serviceHealthCheck = healthService.createExternalServiceHealthCheck(
        service.name,
        service.url
      );
      healthService.registerHealthCheck(service.name, serviceHealthCheck);
    });
  }

  // Memory health check
  const memoryHealthCheck = healthService.createMemoryHealthCheck(
    'memory',
    512
  );
  healthService.registerHealthCheck('memory', memoryHealthCheck);

  // Disk space health check
  const diskHealthCheck = healthService.createDiskSpaceHealthCheck(
    'disk_space',
    process.cwd(),
    1
  );
  healthService.registerHealthCheck('disk_space', diskHealthCheck);
}

// Utility function to create request logging middleware
export function createRequestLoggingMiddleware(loggingService: LoggingService) {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Add request ID to request object
    req.requestId = requestId;

    // Create child logger with request context
    req.logger = loggingService.child({
      requestId,
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    // Log request start
    req.logger.info(`Request started: ${req.method} ${req.url}`);

    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function (...args: any[]) {
      const duration = Date.now() - startTime;

      req.logger.logRequest(req.method, req.url, res.statusCode, duration, {
        requestId,
        responseSize: res.get('Content-Length'),
      });

      originalEnd.apply(res, args);
    };

    next();
  };
}

// Utility function to create error handling middleware
export function createErrorHandlingMiddleware(
  loggingService: LoggingService,
  errorTrackingService: ErrorTrackingService
) {
  return (error: Error, req: any, res: any, next: any) => {
    const context = {
      requestId: req.requestId,
      userId: req.user?.id,
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      body: req.body,
      query: req.query,
      params: req.params,
    };

    // Track the error
    const errorId = errorTrackingService.trackError(error, 'error', context);

    // Log the error
    loggingService.error(
      `Unhandled error in request: ${error.message}`,
      error,
      { ...context, errorId }
    );

    // Send error response
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal Server Error',
        errorId,
        message:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }

    next();
  };
}
