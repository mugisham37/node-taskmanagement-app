/**
 * Logger interface for consistent logging across the application
 */
export interface ILogger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  fatal(message: string, meta?: any): void;
}

/**
 * Log level enumeration
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level: LogLevel;
  format: 'json' | 'text';
  transports: LogTransport[];
}

/**
 * Log transport configuration
 */
export interface LogTransport {
  type: 'console' | 'file' | 'http';
  options?: Record<string, any>;
}
