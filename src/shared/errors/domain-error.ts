import { AppError } from './app-error';

/**
 * Base class for domain-specific errors
 * These represent business rule violations
 */
export class DomainError extends AppError {
  readonly statusCode = 400;
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
 * Error thrown when a business rule is violated
 */
export class BusinessRuleViolationError extends DomainError {
  constructor(rule: string, message: string, context?: Record<string, any>) {
    super(message, 'BUSINESS_RULE_VIOLATION', { rule, ...context });
  }
}

/**
 * Error thrown when an aggregate invariant is violated
 */
export class InvariantViolationError extends DomainError {
  constructor(
    invariant: string,
    message: string,
    context?: Record<string, any>
  ) {
    super(message, 'INVARIANT_VIOLATION', { invariant, ...context });
  }
}

/**
 * Error thrown when an invalid state transition is attempted
 */
export class InvalidStateTransitionError extends DomainError {
  constructor(
    fromState: string,
    toState: string,
    entityType: string,
    context?: Record<string, any>
  ) {
    super(
      `Invalid state transition from ${fromState} to ${toState} for ${entityType}`,
      'INVALID_STATE_TRANSITION',
      { fromState, toState, entityType, ...context }
    );
  }
}

/**
 * Error thrown when a domain operation is not allowed
 */
export class OperationNotAllowedError extends DomainError {
  constructor(
    operation: string,
    reason: string,
    context?: Record<string, any>
  ) {
    super(
      `Operation '${operation}' is not allowed: ${reason}`,
      'OPERATION_NOT_ALLOWED',
      { operation, reason, ...context }
    );
  }
}
