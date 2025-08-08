/**
 * Consolidated Logging Service
 * Single logger service with structured logging, proper formatting, and transport configuration
 */

import winston from 'winston';
import path from 'path';
import { performance } from 'perf_hooks';

export interface LogContext {
  [key: string]: any;
}

export interface ILogger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  createChildLogger(context: LogContext): ILogger;
  startTimer(label: string): () => void;
  profile(id: string): void;
  setLevel(level: string): void;
  getLevel(): string;
}

export interface LoggerConfig {
  level?: string;
  enableConsole?: boolean;
  enableFile?: boolean;
  enableJson?: boolean;
  logDirectory?: string;
  maxFileSize?: string;
  maxFiles?: number;
  enableColors?: boolean;
  enableTimestamp?: boolean;
  enableStackTrace?: boolean;
  serviceName?: string;
  environment?: string;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  service?: string;
  environment?: string;
  context?: LogContext;
  stack?: string;
  duration?: number;
  requestId?: string;
  userId?: string;
  sessionId?: string;
}

/**
 * Custom Winston formatter for structured logging
 */
const createStructuredFormat = (config: LoggerConfig) => {
  return winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS',
    }),
    winston.format.errors({ stack: config.enableStackTrace !== false }),
    winston.format.printf(info => {
      const logEntry: LogEntry = {
        timestamp: info.timestamp,
        level: info.level.toUpperCase(),
        message: info.message,
        service: config.serviceName,
        environment: config.environment,
      };

      // Add context if present
      if (
        info.context ||
        Object.keys(info).some(
          key => !['timestamp', 'level', 'message', 'stack'].includes(key)
        )
      ) {
        logEntry.context = {
          ...info.context,
          ...Object.keys(info).reduce((acc, key) => {
            if (
              !['timestamp', 'level', 'message', 'stack', 'context'].includes(
                key
              )
            ) {
              acc[key] = info[key];
            }
            return acc;
          }, {} as LogContext),
        };
      }

      // Add stack trace for errors
      if (info.stack && config.enableStackTrace !== false) {
        logEntry.stack = info.stack;
      }

      return config.enableJson !== false
        ? JSON.stringify(logEntry)
        : `${logEntry.timestamp} [${logEntry.level}] ${logEntry.message}${logEntry.context ? ` ${JSON.stringify(logEntry.context)}` : ''}`;
    })
  );
};

/**
 * Consolidated Logger Implementation
 */
export class ConsolidatedLogger implements ILogger {
  private winston: winston.Logger;
  private context: LogContext;
  private config: Required<LoggerConfig>;
  private timers: Map<string, number> = new Map();

  constructor(config: LoggerConfig = {}, context: LogContext = {}) {
    this.config = {
      level: config.level || process.env.LOG_LEVEL || 'info',
      enableConsole: config.enableConsole !== false,
      enableFile: config.enableFile !== false,
      enableJson: config.enableJson !== false,
      logDirectory: config.logDirectory || 'logs',
      maxFileSize: config.maxFileSize || '20m',
      maxFiles: config.maxFiles || 5,
      enableColors: config.enableColors !== false,
      enableTimestamp: config.enableTimestamp !== false,
      enableStackTrace: config.enableStackTrace !== false,
      serviceName: config.serviceName || 'unified-enterprise-platform',
      environment: config.environment || process.env.NODE_ENV || 'development',
    };

    this.context = context;
    this.winston = this.createWinstonLogger();
  }

  private createWinstonLogger(): winston.Logger {
    const transports: winston.transport[] = [];

    // Console transport
    if (this.config.enableConsole) {
      transports.push(
        new winston.transports.Console({
          level: this.config.level,
          format: winston.format.combine(
            this.config.enableColors
              ? winston.format.colorize()
              : winston.format.uncolorize(),
            this.config.enableJson
              ? createStructuredFormat(this.config)
              : winston.format.combine(
                  winston.format.timestamp({ format: 'HH:mm:ss' }),
                  winston.format.printf(
                    ({ timestamp, level, message, ...meta }) => {
                      const contextStr =
                        Object.keys(meta).length > 0
                          ? ` ${JSON.stringify(meta)}`
                          : '';
                      return `${timestamp} [${level.toUpperCase()}] ${message}${contextStr}`;
                    }
                  )
                )
          ),
        })
      );
    }

    // File transports
    if (this.config.enableFile) {
      // Combined log file
      transports.push(
        new winston.transports.File({
          filename: path.join(this.config.logDirectory, 'combined.log'),
          level: this.config.level,
          format: createStructuredFormat(this.config),
          maxsize: this.parseFileSize(this.config.maxFileSize),
          maxFiles: this.config.maxFiles,
          tailable: true,
        })
      );

      // Error log file
      transports.push(
        new winston.transports.File({
          filename: path.join(this.config.logDirectory, 'error.log'),
          level: 'error',
          format: createStructuredFormat(this.config),
          maxsize: this.parseFileSize(this.config.maxFileSize),
          maxFiles: this.config.maxFiles,
          tailable: true,
        })
      );

      // Debug log file (only in development)
      if (this.config.environment === 'development') {
        transports.push(
          new winston.transports.File({
            filename: path.join(this.config.logDirectory, 'debug.log'),
            level: 'debug',
            format: createStructuredFormat(this.config),
            maxsize: this.parseFileSize(this.config.maxFileSize),
            maxFiles: this.config.maxFiles,
            tailable: true,
          })
        );
      }
    }

    return winston.createLogger({
      level: this.config.level,
      transports,
      exitOnError: false,
      // Handle uncaught exceptions and rejections
      exceptionHandlers: this.config.enableFile
        ? [
            new winston.transports.File({
              filename: path.join(this.config.logDirectory, 'exceptions.log'),
              format: createStructuredFormat(this.config),
            }),
          ]
        : [],
      rejectionHandlers: this.config.enableFile
        ? [
            new winston.transports.File({
              filename: path.join(this.config.logDirectory, 'rejections.log'),
              format: createStructuredFormat(this.config),
            }),
          ]
        : [],
    });
  }

  private parseFileSize(size: string): number {
    const units: { [key: string]: number } = {
      b: 1,
      k: 1024,
      m: 1024 * 1024,
      g: 1024 * 1024 * 1024,
    };

    const match = size.toLowerCase().match(/^(\d+)([bkmg]?)$/);
    if (!match) {
      return 20 * 1024 * 1024; // Default 20MB
    }

    const [, num, unit] = match;
    return parseInt(num) * (units[unit] || 1);
  }

  private formatMessage(message: string, context?: LogContext): any {
    const enrichedContext = {
      ...this.context,
      ...context,
      timestamp: new Date().toISOString(),
      pid: process.pid,
    };

    // Add request context if available
    if (global.requestContext) {
      const reqContext = global.requestContext as any;
      enrichedContext.requestId = reqContext.requestId;
      enrichedContext.userId = reqContext.userId;
      enrichedContext.sessionId = reqContext.sessionId;
    }

    return {
      message,
      context: enrichedContext,
    };
  }

  debug(message: string, context?: LogContext): void {
    const formatted = this.formatMessage(message, context);
    this.winston.debug(formatted.message, formatted.context);
  }

  info(message: string, context?: LogContext): void {
    const formatted = this.formatMessage(message, context);
    this.winston.info(formatted.message, formatted.context);
  }

  warn(message: string, context?: LogContext): void {
    const formatted = this.formatMessage(message, context);
    this.winston.warn(formatted.message, formatted.context);
  }

  error(message: string, context?: LogContext): void {
    const formatted = this.formatMessage(message, context);
    this.winston.error(formatted.message, formatted.context);
  }

  createChildLogger(context: LogContext): ILogger {
    return new ConsolidatedLogger(this.config, { ...this.context, ...context });
  }

  startTimer(label: string): () => void {
    const startTime = performance.now();
    this.timers.set(label, startTime);

    return () => {
      const endTime = performance.now();
      const duration = Math.round((endTime - startTime) * 100) / 100;
      this.timers.delete(label);

      this.info(`Timer completed: ${label}`, {
        duration: `${duration}ms`,
        label,
      });

      return duration;
    };
  }

  profile(id: string): void {
    this.winston.profile(id);
  }

  setLevel(level: string): void {
    this.winston.level = level;
    this.config.level = level;
  }

  getLevel(): string {
    return this.winston.level;
  }

  // Additional utility methods
  logRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    context?: LogContext
  ): void {
    const level =
      statusCode >= 400 ? 'error' : statusCode >= 300 ? 'warn' : 'info';
    this[level as keyof ILogger](`${method} ${url} ${statusCode}`, {
      ...context,
      method,
      url,
      statusCode,
      duration: `${duration}ms`,
      type: 'http_request',
    });
  }

  logDatabaseQuery(
    query: string,
    duration: number,
    context?: LogContext
  ): void {
    const level = duration > 1000 ? 'warn' : 'debug';
    this[level as keyof ILogger]('Database query executed', {
      ...context,
      query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
      duration: `${duration}ms`,
      type: 'database_query',
    });
  }

  logCacheOperation(
    operation: string,
    key: string,
    hit: boolean,
    duration?: number,
    context?: LogContext
  ): void {
    this.debug(`Cache ${operation}: ${hit ? 'HIT' : 'MISS'}`, {
      ...context,
      operation,
      key,
      hit,
      duration: duration ? `${duration}ms` : undefined,
      type: 'cache_operation',
    });
  }

  logBusinessEvent(
    event: string,
    entityType: string,
    entityId: string,
    context?: LogContext
  ): void {
    this.info(`Business event: ${event}`, {
      ...context,
      event,
      entityType,
      entityId,
      type: 'business_event',
    });
  }

  logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    context?: LogContext
  ): void {
    const level =
      severity === 'critical' ? 'error' : severity === 'high' ? 'warn' : 'info';
    this[level as keyof ILogger](`Security event: ${event}`, {
      ...context,
      event,
      severity,
      type: 'security_event',
    });
  }

  logPerformanceMetric(
    metric: string,
    value: number,
    unit: string,
    context?: LogContext
  ): void {
    this.info(`Performance metric: ${metric}`, {
      ...context,
      metric,
      value,
      unit,
      type: 'performance_metric',
    });
  }

  // Health check for logger
  async healthCheck(): Promise<boolean> {
    try {
      this.info('Logger health check', { type: 'health_check' });
      return true;
    } catch (error) {
      console.error('Logger health check failed:', error);
      return false;
    }
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    return new Promise(resolve => {
      this.winston.end(() => {
        this.info('Logger shutdown complete');
        resolve();
      });
    });
  }
}

// Logger factory and singleton management
class LoggerFactory {
  private static instance: ConsolidatedLogger | null = null;
  private static config: LoggerConfig = {};

  static configure(config: LoggerConfig): void {
    LoggerFactory.config = config;
    LoggerFactory.instance = null; // Reset instance to apply new config
  }

  static getInstance(): ConsolidatedLogger {
    if (!LoggerFactory.instance) {
      LoggerFactory.instance = new ConsolidatedLogger(LoggerFactory.config);
    }
    return LoggerFactory.instance;
  }

  static createLogger(context?: LogContext): ConsolidatedLogger {
    return new ConsolidatedLogger(LoggerFactory.config, context);
  }

  static createChildLogger(context: LogContext): ConsolidatedLogger {
    return LoggerFactory.getInstance().createChildLogger(
      context
    ) as ConsolidatedLogger;
  }
}

// Export singleton instance and factory
export const logger = LoggerFactory.getInstance();
export const createLogger = LoggerFactory.createLogger;
export const createChildLogger = LoggerFactory.createChildLogger;
export const configureLogger = LoggerFactory.configure;

// Export logger factory for advanced usage
export { LoggerFactory };

// Middleware for request logging
export function createRequestLogger() {
  return (req: any, res: any, next: any) => {
    const startTime = performance.now();
    const requestId =
      req.headers['x-request-id'] ||
      `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Set global request context
    (global as any).requestContext = {
      requestId,
      userId: req.user?.id,
      sessionId: req.session?.id,
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
    };

    // Create request-specific logger
    const requestLogger = createChildLogger({ requestId });

    // Log request start
    requestLogger.info('Request started', {
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
    });

    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function (...args: any[]) {
      const duration = Math.round((performance.now() - startTime) * 100) / 100;

      requestLogger.logRequest(req.method, req.url, res.statusCode, duration, {
        responseSize: res.get('content-length'),
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection.remoteAddress,
      });

      // Clear global request context
      delete (global as any).requestContext;

      originalEnd.apply(this, args);
    };

    next();
  };
}
