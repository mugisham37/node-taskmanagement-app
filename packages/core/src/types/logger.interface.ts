/**
 * Logger interfaces for consistent logging across the application
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

export interface LogContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  operation?: string;
  [key: string]: any;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: LogContext;
  error?: Error;
  metadata?: Record<string, any>;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;
  fatal(message: string, error?: Error, context?: LogContext): void;
}

export interface LoggerConfig {
  level: LogLevel;
  format: 'json' | 'text' | 'structured';
  outputs: LogOutput[];
  enableColors?: boolean;
  enableTimestamp?: boolean;
  enableStackTrace?: boolean;
}

export interface LogOutput {
  type: 'console' | 'file' | 'http' | 'database';
  config?: {
    filePath?: string;
    maxFileSize?: number;
    maxFiles?: number;
    url?: string;
    table?: string;
    [key: string]: any;
  };
}

export interface LogFilter {
  level?: LogLevel;
  startTime?: Date;
  endTime?: Date;
  userId?: string;
  requestId?: string;
  operation?: string;
  search?: string;
}

export interface LogQuery {
  filter?: LogFilter;
  sort?: {
    field: 'timestamp' | 'level' | 'message';
    direction: 'asc' | 'desc';
  };
  pagination?: {
    page: number;
    limit: number;
  };
}

export interface LogQueryResult {
  entries: LogEntry[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface LogMetrics {
  totalEntries: number;
  entriesByLevel: Record<LogLevel, number>;
  errorRate: number;
  averageEntriesPerMinute: number;
  topOperations: Array<{
    operation: string;
    count: number;
  }>;
  topErrors: Array<{
    error: string;
    count: number;
  }>;
}

export interface LogArchive {
  id: string;
  startTime: Date;
  endTime: Date;
  entryCount: number;
  filePath: string;
  compressed: boolean;
  createdAt: Date;
}

export interface LogRetentionPolicy {
  maxAge: number; // in days
  maxSize: number; // in bytes
  compressionEnabled: boolean;
  archiveEnabled: boolean;
  archiveLocation?: string;
}

export interface StructuredLogData {
  service: string;
  version: string;
  environment: string;
  hostname: string;
  pid: number;
  [key: string]: any;
}