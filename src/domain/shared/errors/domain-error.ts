/**
 * Base class for all domain-specific errors
 * Provides consistent error structure across all domains
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  readonly timestamp: Date = new Date();
  readonly correlationId?: string;

  constructor(
    message: string,
    public readonly context?: Record<string, unknown>,
    correlationId?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    this.correlationId = correlationId;
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON representation
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      correlationId: this.correlationId,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Authentication domain errors
 */
export class AuthenticationError extends DomainError {
  readonly code = 'AUTH_ERROR';
  readonly statusCode = 401;
}

export class AuthorizationError extends DomainError {
  readonly code = 'AUTHORIZATION_ERROR';
  readonly statusCode = 403;
}

export class InvalidCredentialsError extends DomainError {
  readonly code = 'INVALID_CREDENTIALS';
  readonly statusCode = 401;
}

export class TokenExpiredError extends DomainError {
  readonly code = 'TOKEN_EXPIRED';
  readonly statusCode = 401;
}

export class InvalidTokenError extends DomainError {
  readonly code = 'INVALID_TOKEN';
  readonly statusCode = 401;
}

/**
 * Task management domain errors
 */
export class TaskNotFoundError extends DomainError {
  readonly code = 'TASK_NOT_FOUND';
  readonly statusCode = 404;
}

export class ProjectNotFoundError extends DomainError {
  readonly code = 'PROJECT_NOT_FOUND';
  readonly statusCode = 404;
}

export class WorkspaceNotFoundError extends DomainError {
  readonly code = 'WORKSPACE_NOT_FOUND';
  readonly statusCode = 404;
}

export class WorkspaceAccessDeniedError extends DomainError {
  readonly code = 'WORKSPACE_ACCESS_DENIED';
  readonly statusCode = 403;
}

export class TaskAssignmentError extends DomainError {
  readonly code = 'TASK_ASSIGNMENT_ERROR';
  readonly statusCode = 400;
}

/**
 * Validation errors
 */
export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;
}

export class BusinessRuleViolationError extends DomainError {
  readonly code = 'BUSINESS_RULE_VIOLATION';
  readonly statusCode = 400;
}

/**
 * Infrastructure errors
 */
export class DatabaseError extends DomainError {
  readonly code = 'DATABASE_ERROR';
  readonly statusCode = 500;
}

export class CacheError extends DomainError {
  readonly code = 'CACHE_ERROR';
  readonly statusCode = 500;
}

export class ExternalServiceError extends DomainError {
  readonly code = 'EXTERNAL_SERVICE_ERROR';
  readonly statusCode = 502;
}

/**
 * Cross-domain errors
 */
export class CrossDomainValidationError extends DomainError {
  readonly code = 'CROSS_DOMAIN_VALIDATION_ERROR';
  readonly statusCode = 400;
}

export class ConcurrencyError extends DomainError {
  readonly code = 'CONCURRENCY_ERROR';
  readonly statusCode = 409;
}

/**
 * File management errors
 */
export class FileNotFoundError extends DomainError {
  readonly code = 'FILE_NOT_FOUND';
  readonly statusCode = 404;
}

export class FileSizeExceededError extends DomainError {
  readonly code = 'FILE_SIZE_EXCEEDED';
  readonly statusCode = 413;
}

export class UnsupportedFileTypeError extends DomainError {
  readonly code = 'UNSUPPORTED_FILE_TYPE';
  readonly statusCode = 415;
}

/**
 * Rate limiting errors
 */
export class RateLimitExceededError extends DomainError {
  readonly code = 'RATE_LIMIT_EXCEEDED';
  readonly statusCode = 429;
}