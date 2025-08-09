// Base error classes
export { AppError } from './app-error';

// Domain errors
export {
  DomainError,
  BusinessRuleViolationError,
  InvariantViolationError,
  InvalidStateTransitionError,
  OperationNotAllowedError,
} from './domain-error';

// Validation errors
export {
  ValidationError,
  type ValidationErrorDetail,
} from './validation-error';

// Not found errors
export {
  NotFoundError,
  UserNotFoundError,
  TaskNotFoundError,
  ProjectNotFoundError,
  WorkspaceNotFoundError,
} from './not-found-error';

// Authorization errors
export {
  AuthenticationError,
  AuthorizationError,
  InsufficientPermissionsError,
  InvalidTokenError,
  TokenExpiredError,
  MissingTokenError,
} from './authorization-error';

// Infrastructure errors
export {
  InfrastructureError,
  DatabaseError,
  DatabaseConnectionError,
  TransactionError,
  ExternalServiceError,
  CacheError,
  EmailError,
  FileSystemError,
  ConfigurationError,
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
