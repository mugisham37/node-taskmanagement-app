// Base error classes
export { AppError } from './app-error';

// Domain errors
export {
    BusinessRuleViolationError, DomainError, InvalidStateTransitionError, InvariantViolationError, OperationNotAllowedError
} from './domain-error';

// Validation errors
export {
    ValidationError,
    type ValidationErrorDetail
} from './validation-error';

// Not found errors
export {
    NotFoundError, ProjectNotFoundError, TaskNotFoundError, UserNotFoundError, WorkspaceNotFoundError
} from './not-found-error';

// Authorization errors
export {
    AuthenticationError,
    AuthorizationError,
    InsufficientPermissionsError,
    InvalidTokenError, MissingTokenError, TokenExpiredError
} from './authorization-error';

// Infrastructure errors
export {
    CacheError, ConfigurationError, DatabaseConnectionError, DatabaseError, EmailError, ExternalServiceError, FileSystemError, InfrastructureError, TransactionError
} from './infrastructure-error';

// Import AppError for type guards
import { AppError } from './app-error';

/**
 * Type guard to check if an error is an operational error
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Type guard to check if an error is an AppError
 */
export function isAppError(error: Error): error is AppError {
  return error instanceof AppError;
}