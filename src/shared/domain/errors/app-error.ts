import { DomainError } from './domain-error';

/**
 * Base application error class
 */
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Validation error for input validation failures
 */
export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';

  constructor(message: string = 'Validation failed') {
    super(message);
  }
}

/**
 * Not found error for missing resources
 */
export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND';

  constructor(message: string = 'Resource not found') {
    super(message);
  }
}

/**
 * Unauthorized error for authentication failures
 */
export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly code = 'UNAUTHORIZED';

  constructor(message: string = 'Unauthorized access') {
    super(message);
  }
}

/**
 * Forbidden error for authorization failures
 */
export class ForbiddenError extends AppError {
  readonly statusCode = 403;
  readonly code = 'FORBIDDEN';

  constructor(message: string = 'Access forbidden') {
    super(message);
  }
}

/**
 * Conflict error for resource conflicts
 */
export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code = 'CONFLICT';

  constructor(message: string = 'Resource conflict') {
    super(message);
  }
}

/**
 * Too many requests error for rate limiting
 */
export class TooManyRequestsError extends AppError {
  readonly statusCode = 429;
  readonly code = 'TOO_MANY_REQUESTS';

  constructor(message: string = 'Too many requests') {
    super(message);
  }
}

/**
 * Internal server error for unexpected failures
 */
export class InternalServerError extends AppError {
  readonly statusCode = 500;
  readonly code = 'INTERNAL_SERVER_ERROR';

  constructor(message: string = 'Internal server error') {
    super(message);
  }
}

/**
 * Service unavailable error for service outages
 */
export class ServiceUnavailableError extends AppError {
  readonly statusCode = 503;
  readonly code = 'SERVICE_UNAVAILABLE';

  constructor(message: string = 'Service unavailable') {
    super(message);
  }
}
