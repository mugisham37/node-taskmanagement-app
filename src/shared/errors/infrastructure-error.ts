import { AppError } from './app-error';

/**
 * Base class for infrastructure-related errors
 */
export class InfrastructureError extends AppError {
  readonly statusCode = 500;
  readonly isOperational = true;

  constructor(
    message: string,
    errorCode?: string,
    context?: Record<string, any>
  ) {
    super(message, errorCode, context);
  }
}

/**
 * Error thrown when database operations fail
 */
export class DatabaseError extends InfrastructureError {
  constructor(
    message: string,
    operation?: string,
    context?: Record<string, any>
  ) {
    super(message, 'DATABASE_ERROR', { operation, ...context });
  }
}

/**
 * Error thrown when database connection fails
 */
export class DatabaseConnectionError extends DatabaseError {
  constructor(message?: string, context?: Record<string, any>) {
    super(
      message || 'Failed to connect to database',
      'DATABASE_CONNECTION_ERROR',
      context
    );
  }
}

/**
 * Error thrown when a database transaction fails
 */
export class TransactionError extends DatabaseError {
  constructor(message?: string, context?: Record<string, any>) {
    super(
      message || 'Database transaction failed',
      'TRANSACTION_ERROR',
      context
    );
  }
}

/**
 * Error thrown when external service calls fail
 */
export class ExternalServiceError extends InfrastructureError {
  constructor(
    serviceName: string,
    message: string,
    statusCode?: number,
    context?: Record<string, any>
  ) {
    super(
      `External service '${serviceName}' error: ${message}`,
      'EXTERNAL_SERVICE_ERROR',
      { serviceName, statusCode, ...context }
    );
  }
}

/**
 * Error thrown when cache operations fail
 */
export class CacheError extends InfrastructureError {
  constructor(
    operation: string,
    message?: string,
    context?: Record<string, any>
  ) {
    super(message || `Cache ${operation} operation failed`, 'CACHE_ERROR', {
      operation,
      ...context,
    });
  }
}

/**
 * Error thrown when email sending fails
 */
export class EmailError extends InfrastructureError {
  constructor(
    message: string,
    recipient?: string,
    context?: Record<string, any>
  ) {
    super(message, 'EMAIL_ERROR', { recipient, ...context });
  }
}

/**
 * Error thrown when file operations fail
 */
export class FileSystemError extends InfrastructureError {
  constructor(
    operation: string,
    filePath: string,
    message?: string,
    context?: Record<string, any>
  ) {
    super(
      message || `File system ${operation} failed for ${filePath}`,
      'FILESYSTEM_ERROR',
      { operation, filePath, ...context }
    );
  }
}

/**
 * Error thrown when configuration is invalid or missing
 */
export class ConfigurationError extends AppError {
  readonly statusCode = 500;
  readonly isOperational = false; // Configuration errors are not operational

  constructor(
    configKey: string,
    message?: string,
    context?: Record<string, any>
  ) {
    super(
      message || `Configuration error for key '${configKey}'`,
      'CONFIGURATION_ERROR',
      { configKey, ...context }
    );
  }
}
