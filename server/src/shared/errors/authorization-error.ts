import { AppError } from './app-error';

/**
 * Error thrown when authentication fails
 */
export class AuthenticationError extends AppError {
  readonly statusCode = 401;
  readonly isOperational = true;

  constructor(
    message: string = 'Authentication failed',
    context?: Record<string, any>
  ) {
    super(message, 'AUTHENTICATION_FAILED', context);
  }
}

/**
 * Error thrown when authorization fails (user is authenticated but lacks permissions)
 */
export class AuthorizationError extends AppError {
  readonly statusCode = 403;
  readonly isOperational = true;

  constructor(
    message: string = 'Access denied',
    context?: Record<string, any>
  ) {
    super(message, 'ACCESS_DENIED', context);
  }
}

/**
 * Error thrown when user lacks sufficient permissions for an operation
 */
export class InsufficientPermissionsError extends AuthorizationError {
  constructor(
    operation: string,
    resource?: string,
    context?: Record<string, any>
  ) {
    const message = resource
      ? `Insufficient permissions to ${operation} ${resource}`
      : `Insufficient permissions to ${operation}`;

    super(message, { operation, resource, ...context });
  }
}

/**
 * Error thrown when a JWT token is invalid
 */
export class InvalidTokenError extends AuthenticationError {
  constructor(reason?: string, context?: Record<string, any>) {
    const message = reason ? `Invalid token: ${reason}` : 'Invalid token';

    super(message, { reason, ...context });
  }
}

/**
 * Error thrown when a JWT token has expired
 */
export class TokenExpiredError extends AuthenticationError {
  constructor(context?: Record<string, any>) {
    super('Token has expired', context);
  }
}

/**
 * Error thrown when no authentication token is provided
 */
export class MissingTokenError extends AuthenticationError {
  constructor(context?: Record<string, any>) {
    super('Authentication token is required', context);
  }
}
