/**
 * Consolidated Logging Infrastructure
 * Single point of access for all logging functionality
 */

// Consolidated logging service
export {
  ConsolidatedLogger,
  logger,
  createLogger,
  createChildLogger,
  configureLogger,
  LoggerFactory,
  createRequestLogger,
} from './consolidated-logger';

export type {
  ILogger,
  LogContext,
  LoggerConfig,
  LogEntry,
} from './consolidated-logger';

// Legacy logger (for backward compatibility)
export { logger as legacyLogger } from './logger';
