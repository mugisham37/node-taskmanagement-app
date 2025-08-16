import { z } from 'zod';
import { environmentLoader } from '../environment/environment-loader';

/**
 * Logging configuration schema
 */
const LoggingConfigSchema = z.object({
  level: z.enum(['error', 'warn', 'info', 'debug', 'trace']).default('info'),
  format: z.enum(['json', 'simple', 'combined']).default('json'),
  colorize: z.boolean().default(false),
  timestamp: z.boolean().default(true),
  maxFiles: z.number().default(5),
  maxSize: z.string().default('20m'),
  datePattern: z.string().default('YYYY-MM-DD'),
  auditFile: z.string().default('audit.json'),
  errorFile: z.string().default('error.log'),
  combinedFile: z.string().default('combined.log'),
  enableConsole: z.boolean().default(true),
  enableFile: z.boolean().default(true),
  enableRemote: z.boolean().default(false),
  remoteUrl: z.string().optional(),
});

/**
 * Metrics configuration schema
 */
const MetricsConfigSchema = z.object({
  enabled: z.boolean().default(true),
  port: z.number().min(1).max(65535).default(9090),
  path: z.string().default('/metrics'),
  collectDefaultMetrics: z.boolean().default(true),
  defaultMetricsInterval: z.number().default(10000), // 10 seconds
  buckets: z.array(z.number()).default([0.1, 0.5, 1, 2, 5, 10]),
  percentiles: z.array(z.number()).default([0.5, 0.9, 0.95, 0.99]),
  maxAgeSeconds: z.number().default(600), // 10 minutes
  ageBuckets: z.number().default(5),
  prefix: z.string().default('taskmanagement_'),
});

/**
 * Health check configuration schema
 */
const HealthCheckConfigSchema = z.object({
  enabled: z.boolean().default(true),
  path: z.string().default('/health'),
  interval: z.number().default(30000), // 30 seconds
  timeout: z.number().default(5000), // 5 seconds
  retries: z.number().default(3),
  gracefulShutdownTimeout: z.number().default(10000), // 10 seconds
  checks: z.object({
    database: z.boolean().default(true),
    redis: z.boolean().default(true),
    external: z.boolean().default(true),
    memory: z.boolean().default(true),
    disk: z.boolean().default(true),
  }),
  thresholds: z.object({
    memoryUsage: z.number().default(0.9), // 90%
    diskUsage: z.number().default(0.9), // 90%
    responseTime: z.number().default(1000), // 1 second
  }),
});

/**
 * Tracing configuration schema
 */
const TracingConfigSchema = z.object({
  enabled: z.boolean().default(true),
  serviceName: z.string().default('task-management-api'),
  serviceVersion: z.string().default('1.0.0'),
  environment: z.string().default('development'),
  jaeger: z.object({
    endpoint: z.string().default('http://localhost:14268/api/traces'),
    agentHost: z.string().default('localhost'),
    agentPort: z.number().default(6832),
    samplingRate: z.number().min(0).max(1).default(1.0),
  }),
  zipkin: z.object({
    endpoint: z.string().default('http://localhost:9411/api/v2/spans'),
    samplingRate: z.number().min(0).max(1).default(1.0),
  }),
  otlp: z.object({
    endpoint: z.string().default('http://localhost:4318/v1/traces'),
    headers: z.record(z.string()).default({}),
  }),
});

/**
 * Alerting configuration schema
 */
const AlertingConfigSchema = z.object({
  enabled: z.boolean().default(true),
  channels: z.object({
    email: z.object({
      enabled: z.boolean().default(true),
      recipients: z.array(z.string().email()).default([]),
      smtpConfig: z.object({
        host: z.string().optional(),
        port: z.number().optional(),
        secure: z.boolean().default(false),
        auth: z.object({
          user: z.string().optional(),
          pass: z.string().optional(),
        }).optional(),
      }).optional(),
    }),
    slack: z.object({
      enabled: z.boolean().default(false),
      webhookUrl: z.string().optional(),
      channel: z.string().default('#alerts'),
      username: z.string().default('TaskManagement Bot'),
    }),
    webhook: z.object({
      enabled: z.boolean().default(false),
      url: z.string().optional(),
      headers: z.record(z.string()).default({}),
      timeout: z.number().default(5000),
    }),
  }),
  rules: z.array(z.object({
    name: z.string(),
    condition: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    threshold: z.number(),
    duration: z.number().default(300), // 5 minutes
    enabled: z.boolean().default(true),
  })).default([]),
});

/**
 * Performance monitoring configuration schema
 */
const PerformanceConfigSchema = z.object({
  enabled: z.boolean().default(true),
  apm: z.object({
    enabled: z.boolean().default(false),
    serviceName: z.string().default('task-management-api'),
    serverUrl: z.string().optional(),
    secretToken: z.string().optional(),
    environment: z.string().default('development'),
    captureBody: z.enum(['off', 'errors', 'transactions', 'all']).default('errors'),
    captureHeaders: z.boolean().default(true),
  }),
  profiling: z.object({
    enabled: z.boolean().default(false),
    samplingInterval: z.number().default(1000), // 1 second
    maxStackDepth: z.number().default(64),
    includeNodeModules: z.boolean().default(false),
  }),
  monitoring: z.object({
    collectGC: z.boolean().default(true),
    collectEventLoop: z.boolean().default(true),
    collectMemory: z.boolean().default(true),
    collectCPU: z.boolean().default(true),
    collectHandles: z.boolean().default(true),
  }),
});

/**
 * Complete monitoring configuration schema
 */
const MonitoringConfigSchema = z.object({
  logging: LoggingConfigSchema,
  metrics: MetricsConfigSchema,
  healthCheck: HealthCheckConfigSchema,
  tracing: TracingConfigSchema,
  alerting: AlertingConfigSchema,
  performance: PerformanceConfigSchema,
});

export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
export type MetricsConfig = z.infer<typeof MetricsConfigSchema>;
export type HealthCheckConfig = z.infer<typeof HealthCheckConfigSchema>;
export type TracingConfig = z.infer<typeof TracingConfigSchema>;
export type AlertingConfig = z.infer<typeof AlertingConfigSchema>;
export type PerformanceConfig = z.infer<typeof PerformanceConfigSchema>;
export type MonitoringConfig = z.infer<typeof MonitoringConfigSchema>;

/**
 * Monitoring configuration loader
 */
export class MonitoringConfigLoader {
  /**
   * Load complete monitoring configuration
   */
  static load(): MonitoringConfig {
    const environment = environmentLoader.getEnvironment();

    const config = {
      logging: this.getLoggingConfig(environment),
      metrics: this.getMetricsConfig(environment),
      healthCheck: this.getHealthCheckConfig(environment),
      tracing: this.getTracingConfig(environment),
      alerting: this.getAlertingConfig(environment),
      performance: this.getPerformanceConfig(environment),
    };

    return MonitoringConfigSchema.parse(config);
  }

  /**
   * Get logging configuration
   */
  private static getLoggingConfig(environment: string): LoggingConfig {
    const baseConfig = {
      level: 'info' as const,
      format: 'json' as const,
      colorize: false,
      timestamp: true,
      maxFiles: 5,
      maxSize: '20m',
      datePattern: 'YYYY-MM-DD',
      auditFile: 'audit.json',
      errorFile: 'error.log',
      combinedFile: 'combined.log',
      enableConsole: true,
      enableFile: true,
      enableRemote: false,
    };

    switch (environment) {
      case 'production':
        return {
          ...baseConfig,
          level: 'warn',
          colorize: false,
          enableConsole: false,
          enableFile: true,
          enableRemote: true,
          remoteUrl: process.env.LOG_REMOTE_URL,
        };
      
      case 'staging':
        return {
          ...baseConfig,
          level: 'info',
          enableRemote: true,
          remoteUrl: process.env.LOG_REMOTE_URL,
        };
      
      case 'development':
        return {
          ...baseConfig,
          level: 'debug',
          format: 'simple',
          colorize: true,
          enableFile: false,
        };
      
      case 'test':
        return {
          ...baseConfig,
          level: 'error',
          enableConsole: false,
          enableFile: false,
        };
      
      default:
        return baseConfig;
    }
  }

  /**
   * Get metrics configuration
   */
  private static getMetricsConfig(environment: string): MetricsConfig {
    const baseConfig = {
      enabled: true,
      port: 9090,
      path: '/metrics',
      collectDefaultMetrics: true,
      defaultMetricsInterval: 10000,
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      percentiles: [0.5, 0.9, 0.95, 0.99],
      maxAgeSeconds: 600,
      ageBuckets: 5,
      prefix: 'taskmanagement_',
    };

    switch (environment) {
      case 'production':
        return {
          ...baseConfig,
          defaultMetricsInterval: 15000, // Less frequent in production
        };
      
      case 'test':
        return {
          ...baseConfig,
          enabled: false,
        };
      
      default:
        return baseConfig;
    }
  }

  /**
   * Get health check configuration
   */
  private static getHealthCheckConfig(environment: string): HealthCheckConfig {
    const baseConfig = {
      enabled: true,
      path: '/health',
      interval: 30000,
      timeout: 5000,
      retries: 3,
      gracefulShutdownTimeout: 10000,
      checks: {
        database: true,
        redis: true,
        external: true,
        memory: true,
        disk: true,
      },
      thresholds: {
        memoryUsage: 0.9,
        diskUsage: 0.9,
        responseTime: 1000,
      },
    };

    switch (environment) {
      case 'production':
        return {
          ...baseConfig,
          interval: 15000, // More frequent in production
          thresholds: {
            memoryUsage: 0.8, // Stricter in production
            diskUsage: 0.8,
            responseTime: 500,
          },
        };
      
      case 'test':
        return {
          ...baseConfig,
          checks: {
            database: false,
            redis: false,
            external: false,
            memory: true,
            disk: false,
          },
        };
      
      default:
        return baseConfig;
    }
  }

  /**
   * Get tracing configuration
   */
  private static getTracingConfig(environment: string): TracingConfig {
    const baseConfig = {
      enabled: true,
      serviceName: 'task-management-api',
      serviceVersion: '1.0.0',
      environment,
      jaeger: {
        endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
        agentHost: process.env.JAEGER_AGENT_HOST || 'localhost',
        agentPort: parseInt(process.env.JAEGER_AGENT_PORT || '6832'),
        samplingRate: 1.0,
      },
      zipkin: {
        endpoint: process.env.ZIPKIN_ENDPOINT || 'http://localhost:9411/api/v2/spans',
        samplingRate: 1.0,
      },
      otlp: {
        endpoint: process.env.OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
        headers: {},
      },
    };

    switch (environment) {
      case 'production':
        return {
          ...baseConfig,
          jaeger: {
            ...baseConfig.jaeger,
            samplingRate: 0.1, // Sample 10% in production
          },
          zipkin: {
            ...baseConfig.zipkin,
            samplingRate: 0.1,
          },
        };
      
      case 'staging':
        return {
          ...baseConfig,
          jaeger: {
            ...baseConfig.jaeger,
            samplingRate: 0.5, // Sample 50% in staging
          },
        };
      
      case 'test':
        return {
          ...baseConfig,
          enabled: false,
        };
      
      default:
        return baseConfig;
    }
  }

  /**
   * Get alerting configuration
   */
  private static getAlertingConfig(environment: string): AlertingConfig {
    const baseConfig = {
      enabled: true,
      channels: {
        email: {
          enabled: true,
          recipients: [],
          smtpConfig: {
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
          },
        },
        slack: {
          enabled: false,
          webhookUrl: process.env.SLACK_WEBHOOK_URL,
          channel: '#alerts',
          username: 'TaskManagement Bot',
        },
        webhook: {
          enabled: false,
          url: process.env.ALERT_WEBHOOK_URL,
          headers: {},
          timeout: 5000,
        },
      },
      rules: [
        {
          name: 'High Error Rate',
          condition: 'error_rate > threshold',
          severity: 'high' as const,
          threshold: 0.05, // 5%
          duration: 300,
          enabled: true,
        },
        {
          name: 'High Response Time',
          condition: 'response_time_p95 > threshold',
          severity: 'medium' as const,
          threshold: 2000, // 2 seconds
          duration: 300,
          enabled: true,
        },
        {
          name: 'Database Connection Issues',
          condition: 'database_connection_errors > threshold',
          severity: 'critical' as const,
          threshold: 10,
          duration: 60,
          enabled: true,
        },
      ],
    };

    switch (environment) {
      case 'production':
        return {
          ...baseConfig,
          channels: {
            ...baseConfig.channels,
            email: {
              ...baseConfig.channels.email,
              recipients: (process.env.ALERT_EMAIL_RECIPIENTS || '').split(',').filter(Boolean),
            },
            slack: {
              ...baseConfig.channels.slack,
              enabled: !!process.env.SLACK_WEBHOOK_URL,
            },
          },
        };
      
      case 'test':
        return {
          ...baseConfig,
          enabled: false,
        };
      
      default:
        return baseConfig;
    }
  }

  /**
   * Get performance monitoring configuration
   */
  private static getPerformanceConfig(environment: string): PerformanceConfig {
    const baseConfig = {
      enabled: true,
      apm: {
        enabled: false,
        serviceName: 'task-management-api',
        serverUrl: process.env.APM_SERVER_URL,
        secretToken: process.env.APM_SECRET_TOKEN,
        environment,
        captureBody: 'errors' as const,
        captureHeaders: true,
      },
      profiling: {
        enabled: false,
        samplingInterval: 1000,
        maxStackDepth: 64,
        includeNodeModules: false,
      },
      monitoring: {
        collectGC: true,
        collectEventLoop: true,
        collectMemory: true,
        collectCPU: true,
        collectHandles: true,
      },
    };

    switch (environment) {
      case 'production':
        return {
          ...baseConfig,
          apm: {
            ...baseConfig.apm,
            enabled: !!process.env.APM_SERVER_URL,
            captureBody: 'errors',
          },
          profiling: {
            ...baseConfig.profiling,
            enabled: false, // Disable profiling in production by default
          },
        };
      
      case 'development':
        return {
          ...baseConfig,
          profiling: {
            ...baseConfig.profiling,
            enabled: true,
          },
        };
      
      case 'test':
        return {
          ...baseConfig,
          enabled: false,
        };
      
      default:
        return baseConfig;
    }
  }

  /**
   * Validate monitoring configuration
   */
  static validate(): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const config = this.load();
      const environment = environmentLoader.getEnvironment();

      // Validate logging configuration
      if (config.logging.enableRemote && !config.logging.remoteUrl) {
        errors.push('Remote logging enabled but no remote URL provided');
      }

      // Validate metrics configuration
      if (config.metrics.enabled && config.metrics.port < 1024 && environment === 'production') {
        warnings.push('Metrics port is in privileged range (< 1024)');
      }

      // Validate tracing configuration
      if (config.tracing.enabled) {
        if (!config.tracing.jaeger.endpoint && !config.tracing.zipkin.endpoint && !config.tracing.otlp.endpoint) {
          warnings.push('Tracing enabled but no endpoints configured');
        }
      }

      // Validate alerting configuration
      if (config.alerting.enabled) {
        const hasEnabledChannel = Object.values(config.alerting.channels).some(channel => channel.enabled);
        if (!hasEnabledChannel) {
          warnings.push('Alerting enabled but no channels configured');
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Monitoring configuration validation failed: ${error}`],
        warnings: [],
      };
    }
  }
}