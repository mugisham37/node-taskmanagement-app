/**
 * CQRS Module Exports
 *
 * This module exports all CQRS infrastructure components for easy importing.
 */

// Core CQRS interfaces and classes
export * from './command';
export * from './command-bus';
export * from './query';
export * from './query-bus';

// Validation infrastructure
export * from '@taskmanagement/validation';

// Factory and configuration
export * from './cqrs-factory';

// Re-export commonly used types
export type {
  CommandExecutionError,
  CommandHandlerNotFoundError,
  CommandValidationError,
  ICommand,
  ICommandBus,
  ICommandHandler,
} from './command';

export type {
  FilterQuery,
  IQuery,
  IQueryBus,
  IQueryHandler,
  PaginatedResult,
  PaginationQuery,
  QueryExecutionError,
  QueryHandlerNotFoundError,
  QueryOptions,
  QueryValidationError,
  SortOptions,
} from './query';

export type {
  ICommandValidator,
  IQueryValidator,
  ValidationResult,
  ValidationRule,
} from '@taskmanagement/validation';

export type { CQRSComponents, CQRSConfiguration } from './cqrs-factory';
