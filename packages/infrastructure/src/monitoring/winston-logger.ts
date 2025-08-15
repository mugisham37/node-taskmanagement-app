import winston, { Logger, LoggerOptions, format, transports } from 'winston';
import { LogContext, LoggingService, StructuredLog } from './interfaces';

export interface WinstonLoggerConfig {
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
  metadata: {
    service: string;
    version: string;
    environment: string;
  };
}

export class WinstonLoggingService implements LoggingService {
  readonly name = 'winston-logger';
  private logger: Logger;
  private performanceMetrics: Map<
    string,
    { startTime: number; startMemory: number }
  > = new Map();

  constructor(private readonly config: WinstonLoggerConfig) {
    this.logger = this.createLogger();
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

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

  child(context: LogContext): LoggingService {
    const childConfig = { ...this.config };
    const childLogger = new WinstonLoggingService(childConfig);

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

  async flush(): Promise<void> {
    return new Promise(resolve => {
      this.logger.on('finish', resolve);
      this.logger.end();
    });
  }

  async close(): Promise<void> {
    await this.flush();
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Test if we can write a log entry
      this.debug('Health check log entry');
      return true;
    } catch (error) {
      return false;
    }
  }

  async getHealthStatus(): Promise<Record<string, any>> {
    const isHealthy = await this.isHealthy();
    return {
      healthy: isHealthy,
      level: this.config.level,
      transports: this.logger.transports.length,
    };
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
   * Get logger instance for direct use
   */
  getLogger(): Logger {
    return this.logger;
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
      throw new Error(`Invalid size format: ${sizeStr}`);
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