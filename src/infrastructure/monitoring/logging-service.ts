import winston, { Logger, LoggerOptions, format, transports } from 'winston';
import { InfrastructureError } from '../../shared/errors/infrastructure-error';

export interface LoggingConfig {
  level: string;
  format: 'json' | 'simple' | 'combined';
  enableConsole: boolean;
  enableFile: boolean;
  enableRotation: boolean;
  fileConfig?: {
    filename: string;
    maxSize: string;
    maxFiles: string;
    dirname: string;
  };
  enableErrorFile: boolean;
  errorFileConfig?: {
    filename: string;
    maxSize: string;
    maxFiles: string;
    dirname: string;
  };
  enableSyslog: boolean;
  syslogConfig?: {
    host: string;
    port: number;
    protocol: string;
    facility: string;
  };
  metadata: {
    service: string;
    version: string;
    environment: string;
  };
}

export interface LogContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  correlationId?: string;
  operation?: string;
  resource?: string;
  action?: string;
  ip?: string;
  userAgent?: string;
  duration?: number;
  [key: string]: any;
}

export interface StructuredLog {
  timestamp: string;
  level: string;
  message: string;
  service: string;
  version: string;
  environment: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  performance?: {
    duration: number;
    memory: number;
    cpu: number;
  };
}

export class LoggingService {
  private logger: Logger;
  private performanceMetrics: Map<
    string,
    { startTime: number; startMemory: number }
  > = new Map();

  constructor(private readonly config: LoggingConfig) {
    this.logger = this.createLogger();
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: LogContext): void {
    const errorContext = error
      ? {
          ...context,
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
            code: (error as any).code,
          },
        }
      : context;

    this.log('error', message, errorContext);
  }

  /**
   * Log fatal error message
   */
  fatal(message: string, error?: Error, context?: LogContext): void {
    const errorContext = error
      ? {
          ...context,
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
            code: (error as any).code,
          },
        }
      : context;

    this.log('error', message, errorContext);
  }

  /**
   * Log HTTP request
   */
  logRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    context?: LogContext
  ): void {
    const level = statusCode >= 400 ? 'warn' : 'info';
    const message = `${method} ${url} ${statusCode} - ${duration}ms`;

    this.log(level, message, {
      ...context,
      operation: 'http_request',
      method,
      url,
      statusCode,
      duration,
    });
  }

  /**
   * Log database operation
   */
  logDatabaseOperation(
    operation: string,
    table: string,
    duration: number,
    rowsAffected?: number,
    context?: LogContext
  ): void {
    const message = `Database ${operation} on ${table} - ${duration}ms`;

    this.log('debug', message, {
      ...context,
      operation: 'database_operation',
      table,
      duration,
      rowsAffected,
    });
  }

  /**
   * Log authentication event
   */
  logAuth(
    event:
      | 'login'
      | 'logout'
      | 'token_refresh'
      | 'password_reset'
      | 'registration',
    userId: string,
    success: boolean,
    context?: LogContext
  ): void {
    const level = success ? 'info' : 'warn';
    const message = `Authentication ${event} ${success ? 'successful' : 'failed'} for user ${userId}`;

    this.log(level, message, {
      ...context,
      operation: 'authentication',
      event,
      userId,
      success,
    });
  }

  /**
   * Log business operation
   */
  logBusinessOperation(
    operation: string,
    resource: string,
    action: string,
    success: boolean,
    context?: LogContext
  ): void {
    const level = success ? 'info' : 'warn';
    const message = `Business operation ${operation} on ${resource} ${success ? 'successful' : 'failed'}`;

    this.log(level, message, {
      ...context,
      operation: 'business_operation',
      resource,
      action,
      success,
    });
  }

  /**
   * Log security event
   */
  logSecurity(
    event:
      | 'rate_limit_exceeded'
      | 'unauthorized_access'
      | 'suspicious_activity'
      | 'permission_denied',
    severity: 'low' | 'medium' | 'high' | 'critical',
    context?: LogContext
  ): void {
    const level =
      severity === 'critical' || severity === 'high' ? 'error' : 'warn';
    const message = `Security event: ${event} (severity: ${severity})`;

    this.log(level, message, {
      ...context,
      operation: 'security_event',
      event,
      severity,
    });
  }

  /**
   * Start performance tracking
   */
  startPerformanceTracking(operationId: string): void {
    this.performanceMetrics.set(operationId, {
      startTime: Date.now(),
      startMemory: process.memoryUsage().heapUsed,
    });
  }

  /**
   * End performance tracking and log results
   */
  endPerformanceTracking(
    operationId: string,
    operation: string,
    context?: LogContext
  ): void {
    const metrics = this.performanceMetrics.get(operationId);

    if (!metrics) {
      this.warn(`Performance tracking not found for operation: ${operationId}`);
      return;
    }

    const duration = Date.now() - metrics.startTime;
    const memoryUsed = process.memoryUsage().heapUsed - metrics.startMemory;

    this.info(`Performance: ${operation} completed in ${duration}ms`, {
      ...context,
      operation: 'performance_tracking',
      operationId,
      performance: {
        duration,
        memory: memoryUsed,
        cpu: process.cpuUsage().user,
      },
    });

    this.performanceMetrics.delete(operationId);
  }

  /**
   * Log with structured format
   */
  logStructured(level: string, structuredLog: Partial<StructuredLog>): void {
    const logEntry: StructuredLog = {
      timestamp: new Date().toISOString(),
      level,
      message: structuredLog.message || '',
      service: this.config.metadata.service,
      version: this.config.metadata.version,
      environment: this.config.metadata.environment,
      ...structuredLog,
    };

    this.logger.log(level, logEntry);
  }

  /**
   * Create child logger with additional context
   */
  child(context: LogContext): LoggingService {
    const childConfig = { ...this.config };
    const childLogger = new LoggingService(childConfig);

    // Override the log method to include the context
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = (
      level: string,
      message: string,
      additionalContext?: LogContext
    ) => {
      originalLog(level, message, { ...context, ...additionalContext });
    };

    return childLogger;
  }

  /**
   * Get logger instance for direct use
   */
  getLogger(): Logger {
    return this.logger;
  }

  /**
   * Flush all logs
   */
  async flush(): Promise<void> {
    return new Promise(resolve => {
      this.logger.on('finish', resolve);
      this.logger.end();
    });
  }

  /**
   * Close logger and cleanup resources
   */
  async close(): Promise<void> {
    await this.flush();
  }

  private log(level: string, message: string, context?: LogContext): void {
    const logEntry = {
      message,
      service: this.config.metadata.service,
      version: this.config.metadata.version,
      environment: this.config.metadata.environment,
      ...context,
    };

    this.logger.log(level, logEntry);
  }

  private createLogger(): Logger {
    const loggerTransports: winston.transport[] = [];

    // Console transport
    if (this.config.enableConsole) {
      loggerTransports.push(
        new transports.Console({
          format: this.getLogFormat(),
        })
      );
    }

    // File transport
    if (this.config.enableFile && this.config.fileConfig) {
      if (this.config.enableRotation) {
        loggerTransports.push(
          new transports.File({
            filename: this.config.fileConfig.filename,
            dirname: this.config.fileConfig.dirname,
            maxsize: this.parseSize(this.config.fileConfig.maxSize),
            maxFiles: parseInt(this.config.fileConfig.maxFiles, 10),
            format: this.getLogFormat(),
          })
        );
      } else {
        loggerTransports.push(
          new transports.File({
            filename: this.config.fileConfig.filename,
            dirname: this.config.fileConfig.dirname,
            format: this.getLogFormat(),
          })
        );
      }
    }

    // Error file transport
    if (this.config.enableErrorFile && this.config.errorFileConfig) {
      loggerTransports.push(
        new transports.File({
          filename: this.config.errorFileConfig.filename,
          dirname: this.config.errorFileConfig.dirname,
          level: 'error',
          maxsize: this.parseSize(this.config.errorFileConfig.maxSize),
          maxFiles: parseInt(this.config.errorFileConfig.maxFiles, 10),
          format: this.getLogFormat(),
        })
      );
    }

    const loggerOptions: LoggerOptions = {
      level: this.config.level,
      transports: loggerTransports,
      exitOnError: false,
      silent: false,
    };

    return winston.createLogger(loggerOptions);
  }

  private getLogFormat() {
    const baseFormat = format.combine(
      format.timestamp(),
      format.errors({ stack: true })
    );

    switch (this.config.format) {
      case 'json':
        return format.combine(baseFormat, format.json());
      case 'simple':
        return format.combine(baseFormat, format.simple());
      case 'combined':
        return format.combine(
          baseFormat,
          format.colorize(),
          format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length
              ? JSON.stringify(meta, null, 2)
              : '';
            return `${timestamp} [${level}]: ${message} ${metaStr}`;
          })
        );
      default:
        return format.combine(baseFormat, format.json());
    }
  }

  private parseSize(sizeStr: string): number {
    const match = sizeStr.match(/^(\d+)(k|m|g)?b?$/i);
    if (!match || !match[1]) {
      throw new InfrastructureError(`Invalid size format: ${sizeStr}`);
    }

    const size = parseInt(match[1], 10);
    const unit = (match[2] || '').toLowerCase();

    switch (unit) {
      case 'k':
        return size * 1024;
      case 'm':
        return size * 1024 * 1024;
      case 'g':
        return size * 1024 * 1024 * 1024;
      default:
        return size;
    }
  }
}
// Default logger instance for application use
const defaultConfig: LoggingConfig = {
  level: process.env['LOG_LEVEL'] || 'info',
  format: 'json',
  enableConsole: true,
  enableFile: false,
  enableRotation: false,
  enableErrorFile: false,
  enableSyslog: false,
  metadata: {
    service: 'task-management',
    version: '1.0.0',
    environment: process.env['NODE_ENV'] || 'development',
  },
};

export const logger = new LoggingService(defaultConfig);

// Export the LoggingService class as Logger for compatibility
export { LoggingService as Logger };
