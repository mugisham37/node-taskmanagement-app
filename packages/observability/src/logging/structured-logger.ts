import { AsyncLocalStorage } from 'async_hooks';
import winston, { Logger, LoggerOptions, format } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

export interface LogContext {
  correlationId?: string;
  userId?: string;
  workspaceId?: string;
  userRole?: string;
  component?: string;
  operation?: string;
  traceId?: string;
  spanId?: string;
  [key: string]: any;
}

export interface StructuredLoggerConfig {
  level: string;
  service: string;
  version: string;
  environment: string;
  enableConsole: boolean;
  enableFile: boolean;
  enableRotation: boolean;
  maxFiles: string;
  maxSize: string;
  datePattern: string;
  logDirectory: string;
  enableElastic: boolean;
  elasticConfig?: {
    host: string;
    port: number;
    index: string;
  };
}

export class StructuredLogger {
  private logger: Logger;
  private contextStorage: AsyncLocalStorage<LogContext>;
  private config: StructuredLoggerConfig;

  constructor(config: Partial<StructuredLoggerConfig> = {}) {
    this.config = {
      level: process.env.LOG_LEVEL || 'info',
      service: process.env.SERVICE_NAME || 'taskmanagement',
      version: process.env.SERVICE_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      enableConsole: true,
      enableFile: true,
      enableRotation: true,
      maxFiles: '14d',
      maxSize: '20m',
      datePattern: 'YYYY-MM-DD',
      logDirectory: './logs',
      enableElastic: false,
      ...config,
    };

    this.contextStorage = new AsyncLocalStorage();
    this.initializeLogger();
  }

  private initializeLogger(): void {
    const transports: winston.transport[] = [];

    // Console transport
    if (this.config.enableConsole) {
      transports.push(
        new winston.transports.Console({
          format: format.combine(
            format.timestamp(),
            format.errors({ stack: true }),
            format.colorize(),
            format.printf(this.formatConsoleLog.bind(this))
          ),
        })
      );
    }

    // File transport with rotation
    if (this.config.enableFile) {
      if (this.config.enableRotation) {
        transports.push(
          new DailyRotateFile({
            filename: `${this.config.logDirectory}/${this.config.service}-%DATE%.log`,
            datePattern: this.config.datePattern,
            maxSize: this.config.maxSize,
            maxFiles: this.config.maxFiles,
            format: format.combine(
              format.timestamp(),
              format.errors({ stack: true }),
              format.json()
            ),
          })
        );

        // Error log file
        transports.push(
          new DailyRotateFile({
            filename: `${this.config.logDirectory}/${this.config.service}-error-%DATE%.log`,
            datePattern: this.config.datePattern,
            maxSize: this.config.maxSize,
            maxFiles: this.config.maxFiles,
            level: 'error',
            format: format.combine(
              format.timestamp(),
              format.errors({ stack: true }),
              format.json()
            ),
          })
        );
      } else {
        transports.push(
          new winston.transports.File({
            filename: `${this.config.logDirectory}/${this.config.service}.log`,
            format: format.combine(
              format.timestamp(),
              format.errors({ stack: true }),
              format.json()
            ),
          })
        );
      }
    }

    // Elasticsearch transport (if enabled)
    if (this.config.enableElastic && this.config.elasticConfig) {
      // Note: You would need to install and configure winston-elasticsearch
      // transports.push(new ElasticsearchTransport(this.config.elasticConfig));
    }

    const loggerOptions: LoggerOptions = {
      level: this.config.level,
      defaultMeta: {
        service: this.config.service,
        version: this.config.version,
        environment: this.config.environment,
        hostname: process.env.HOSTNAME || require('os').hostname(),
        pid: process.pid,
      },
      transports,
      exitOnError: false,
    };

    this.logger = winston.createLogger(loggerOptions);

    // Handle uncaught exceptions and unhandled rejections
    this.logger.exceptions.handle(
      new winston.transports.File({
        filename: `${this.config.logDirectory}/exceptions.log`,
      })
    );

    this.logger.rejections.handle(
      new winston.transports.File({
        filename: `${this.config.logDirectory}/rejections.log`,
      })
    );
  }

  private formatConsoleLog(info: any): string {
    const context = this.getContext();
    const timestamp = info.timestamp;
    const level = info.level;
    const message = info.message;
    const correlationId = context?.correlationId || info.correlationId || 'N/A';
    
    let output = `${timestamp} [${level.toUpperCase()}] [${correlationId}] ${message}`;
    
    // Add context information
    if (context?.userId) output += ` userId=${context.userId}`;
    if (context?.workspaceId) output += ` workspaceId=${context.workspaceId}`;
    if (context?.component) output += ` component=${context.component}`;
    
    // Add additional metadata
    const meta = { ...info };
    delete meta.timestamp;
    delete meta.level;
    delete meta.message;
    delete meta.service;
    delete meta.version;
    delete meta.environment;
    delete meta.hostname;
    delete meta.pid;
    
    if (Object.keys(meta).length > 0) {
      output += ` ${JSON.stringify(meta)}`;
    }
    
    return output;
  }

  // Context management
  setContext(context: LogContext): void {
    const currentContext = this.contextStorage.getStore() || {};
    this.contextStorage.enterWith({ ...currentContext, ...context });
  }

  getContext(): LogContext | undefined {
    return this.contextStorage.getStore();
  }

  runWithContext<T>(context: LogContext, fn: () => T): T {
    return this.contextStorage.run(context, fn);
  }

  // Logging methods with context
  debug(message: string, meta?: any): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: any): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: any): void {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: any): void {
    this.log('error', message, meta);
  }

  fatal(message: string, meta?: any): void {
    this.log('error', message, { ...meta, fatal: true });
  }

  private log(level: string, message: string, meta: any = {}): void {
    const context = this.getContext();
    const logData = {
      ...meta,
      ...context,
      timestamp: new Date().toISOString(),
    };

    this.logger.log(level, message, logData);
  }

  // Structured logging methods
  logUserAction(
    userId: string,
    action: string,
    resource: string,
    workspaceId?: string,
    metadata?: any
  ): void {
    this.info('User action performed', {
      eventType: 'user_action',
      userId,
      action,
      resource,
      workspaceId,
      ...metadata,
    });
  }

  logSystemEvent(
    event: string,
    component: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    metadata?: any
  ): void {
    const level = severity === 'critical' ? 'error' : 
                  severity === 'high' ? 'warn' : 'info';
    
    this.log(level, `System event: ${event}`, {
      eventType: 'system_event',
      event,
      component,
      severity,
      ...metadata,
    });
  }

  logPerformanceMetric(
    operation: string,
    duration: number,
    component: string,
    metadata?: any
  ): void {
    this.info('Performance metric recorded', {
      eventType: 'performance_metric',
      operation,
      duration,
      component,
      ...metadata,
    });
  }

  logSecurityEvent(
    event: string,
    userId?: string,
    ip?: string,
    userAgent?: string,
    metadata?: any
  ): void {
    this.warn('Security event detected', {
      eventType: 'security_event',
      event,
      userId,
      ip,
      userAgent,
      ...metadata,
    });
  }

  logBusinessEvent(
    event: string,
    workspaceId: string,
    userId?: string,
    metadata?: any
  ): void {
    this.info('Business event recorded', {
      eventType: 'business_event',
      event,
      workspaceId,
      userId,
      ...metadata,
    });
  }

  // Query methods for log analysis
  async queryLogs(
    query: {
      level?: string;
      component?: string;
      userId?: string;
      workspaceId?: string;
      eventType?: string;
      startTime?: Date;
      endTime?: Date;
      limit?: number;
    }
  ): Promise<any[]> {
    // This would integrate with your log storage system (Elasticsearch, etc.)
    // For now, return empty array
    return [];
  }

  // Utility methods
  createChildLogger(component: string, additionalContext?: LogContext): StructuredLogger {
    const childLogger = new StructuredLogger(this.config);
    const context = {
      component,
      ...this.getContext(),
      ...additionalContext,
    };
    childLogger.setContext(context);
    return childLogger;
  }

  getLogger(): Logger {
    return this.logger;
  }

  // Cleanup
  close(): Promise<void> {
    return new Promise((resolve) => {
      this.logger.close(() => {
        resolve();
      });
    });
  }
}

export default StructuredLogger;