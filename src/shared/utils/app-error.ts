/**
 * Enhanced application error classes for consistent error handling
 * Combines existing functionality with advanced error management
 */

/**
 * Base error class for operational errors
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly status: string;
  public readonly isOperational: boolean;
  public readonly code?: string | undefined;
  public readonly errors?: any[] | undefined;

  /**
   * @param message Error message
   * @param statusCode HTTP status code
   * @param isOperational Whether this is an operational error
   * @param code Error code for categorization
   * @param errors Array of detailed errors
   */
  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    code?: string,
    errors?: any[]
  ) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = isOperational;
    this.code = code;
    this.errors = errors;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error class
 */
export class ValidationError extends AppError {
  /**
   * @param message Error message
   * @param errors Array of validation errors
   */
  constructor(message: string, errors: any[] = []) {
    super(message, 400, true, 'VALIDATION_ERROR', errors);
  }
}

/**
 * Authentication error class
 */
export class AuthenticationError extends AppError {
  /**
   * @param message Error message
   */
  constructor(message: string = 'Authentication failed') {
    super(message, 401, true, 'AUTHENTICATION_ERROR');
  }
}

/**
 * Authorization/Forbidden error class
 */
export class ForbiddenError extends AppError {
  /**
   * @param message Error message
   */
  constructor(message: string = 'Access forbidden') {
    super(message, 403, true, 'FORBIDDEN_ERROR');
  }
}

/**
 * Not found error class
 */
export class NotFoundError extends AppError {
  /**
   * @param message Error message
   */
  constructor(message: string = 'Resource not found') {
    super(message, 404, true, 'NOT_FOUND_ERROR');
  }
}

/**
 * Conflict error class
 */
export class ConflictError extends AppError {
  /**
   * @param message Error message
   */
  constructor(message: string = 'Resource conflict') {
    super(message, 409, true, 'CONFLICT_ERROR');
  }
}

/**
 * Unprocessable Entity error class
 */
export class UnprocessableEntityError extends AppError {
  /**
   * @param message Error message
   * @param errors Array of validation errors
   */
  constructor(message: string = 'Unprocessable entity', errors?: any[]) {
    super(message, 422, true, 'UNPROCESSABLE_ENTITY_ERROR', errors);
  }
}

/**
 * Too Many Requests error class
 */
export class TooManyRequestsError extends AppError {
  /**
   * @param message Error message
   */
  constructor(message: string = 'Too many requests') {
    super(message, 429, true, 'RATE_LIMIT_ERROR');
  }
}

/**
 * Internal Server Error class
 */
export class InternalServerError extends AppError {
  /**
   * @param message Error message
   */
  constructor(message: string = 'Internal server error') {
    super(message, 500, true, 'INTERNAL_SERVER_ERROR');
  }
}

/**
 * Bad Request error class
 */
export class BadRequestError extends AppError {
  /**
   * @param message Error message
   */
  constructor(message: string = 'Bad request') {
    super(message, 400, true, 'BAD_REQUEST_ERROR');
  }
}

/**
 * Service Unavailable error class
 */
export class ServiceUnavailableError extends AppError {
  /**
   * @param message Error message
   */
  constructor(message: string = 'Service unavailable') {
    super(message, 503, true, 'SERVICE_UNAVAILABLE_ERROR');
  }
}

/**
 * Database error class
 */
export class DatabaseError extends AppError {
  /**
   * @param message Error message
   * @param originalError Original database error
   */
  constructor(message: string = 'Database error', originalError?: Error) {
    super(message, 500, true, 'DATABASE_ERROR');
    if (originalError?.stack) {
      this.stack = originalError.stack;
    }
  }
}

/**
 * External Service error class
 */
export class ExternalServiceError extends AppError {
  /**
   * @param message Error message
   * @param service Service name that failed
   */
  constructor(message: string, service?: string) {
    super(message, 502, true, 'EXTERNAL_SERVICE_ERROR');
    if (service) {
      this.message = `${service}: ${message}`;
    }
  }
}

/**
 * Helper function to create custom errors
 */
export const createError = (
  message: string,
  statusCode: number = 500,
  code?: string,
  errors?: any[]
): AppError => {
  return new AppError(message, statusCode, true, code, errors);
};

/**
 * Type guard to check if error is an AppError
 */
export const isAppError = (error: any): error is AppError => {
  return error instanceof AppError;
};

/**
 * Type guard to check if error is operational
 */
export const isOperationalError = (error: any): boolean => {
  if (isAppError(error)) {
    return error.isOperational;
  }
  return false;
};

/**
 * Helper to format error for logging
 */
export const formatErrorForLogging = (
  error: Error | AppError
): Record<string, any> => {
  const errorInfo: Record<string, any> = {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  };

  if (isAppError(error)) {
    errorInfo['statusCode'] = error.statusCode;
    errorInfo['status'] = error.status;
    errorInfo['code'] = error.code;
    errorInfo['isOperational'] = error.isOperational;
    if (error.errors) {
      errorInfo['errors'] = error.errors;
    }
  }

  return errorInfo;
};

/**
 * Helper to convert unknown errors to AppError
 */
export const normalizeError = (error: unknown): AppError => {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message, 500, false);
  }

  if (typeof error === 'string') {
    return new AppError(error, 500, false);
  }

  return new AppError('An unknown error occurred', 500, false);
};

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Get error severity based on status code
 */
export const getErrorSeverity = (statusCode: number): ErrorSeverity => {
  if (statusCode >= 500) return ErrorSeverity.CRITICAL;
  if (statusCode >= 400) return ErrorSeverity.MEDIUM;
  return ErrorSeverity.LOW;
};

/**
 * Error context for enhanced error tracking
 */
export interface ErrorContext {
  userId?: string;
  requestId?: string;
  operation?: string;
  timestamp?: Date;
  userAgent?: string;
  ip?: string;
  [key: string]: any;
}

/**
 * Enhanced AppError with context
 */
export class ContextualError extends AppError {
  public readonly context: ErrorContext;

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    context: ErrorContext = {},
    errors?: any[]
  ) {
    super(message, statusCode, true, code, errors);
    this.context = {
      timestamp: new Date(),
      ...context,
    };
  }
}

/**
 * Async error wrapper for promises
 */
export const catchAsync = <T extends any[], R>(
  fn: (...args: T) => Promise<R>
) => {
  return (...args: T): Promise<R> => {
    return Promise.resolve(fn(...args)).catch(error => {
      throw normalizeError(error);
    });
  };
};

/**
 * Error aggregator for collecting multiple errors
 */
export class ErrorAggregator {
  private errors: AppError[] = [];

  add(error: AppError | string, statusCode?: number, code?: string): void {
    if (typeof error === 'string') {
      this.errors.push(new AppError(error, statusCode || 400, true, code));
    } else {
      this.errors.push(error);
    }
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  getErrors(): AppError[] {
    return [...this.errors];
  }

  throwIfAny(): void {
    if (this.hasErrors()) {
      const messages = this.errors.map(e => e.message);
      throw new ValidationError('Multiple validation errors', messages);
    }
  }

  clear(): void {
    this.errors = [];
  }

  count(): number {
    return this.errors.length;
  }
}
