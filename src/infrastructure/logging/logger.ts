import winston from 'winston';

export interface LogContext {
  [key: string]: any;
}

export interface ILogger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  createChildLogger(context: LogContext): ILogger;
}

class WinstonLogger implements ILogger {
  private winston: winston.Logger;
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
    this.winston = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
      ],
    });
  }

  debug(message: string, context?: LogContext): void {
    this.winston.debug(message, { ...this.context, ...context });
  }

  info(message: string, context?: LogContext): void {
    this.winston.info(message, { ...this.context, ...context });
  }

  warn(message: string, context?: LogContext): void {
    this.winston.warn(message, { ...this.context, ...context });
  }

  error(message: string, context?: LogContext): void {
    this.winston.error(message, { ...this.context, ...context });
  }

  createChildLogger(context: LogContext): ILogger {
    return new WinstonLogger({ ...this.context, ...context });
  }
}

export const logger = new WinstonLogger();
