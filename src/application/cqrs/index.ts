/**
 * CQRS Module Exports
 *
 * This module exports all CQRS infrastructure components for easy importing.
 */

// Core CQRS interfaces and classes
export * from './command';
export * from './query';
export * from './command-bus';
export * from './query-bus';

// Validation infrastructure
export * from './validation/command-validator';
export * from './validation/query-validator';

// Factory and configuration
export * from './cqrs-factory';

// Re-export commonly used types
export type {
  ICommand,
  ICommandHandler,
  ICommandBus,
  CommandValidationError,
  CommandHandlerNotFoundError,
  CommandExecutionError,
} from './command';

export type {
  IQuery,
  IQueryHandler,
  IQueryBus,
  PaginationQuery,
  PaginatedResult,
  FilterQuery,
  SortOptions,
  QueryOptions,
  QueryValidationError,
  QueryHandlerNotFoundError,
  QueryExecutionError,
} from './query';

export type {
  ICommandValidator,
  IQueryValidator,
  ValidationResult,
  ValidationRule,
} from './validation/command-validator';

export type { CQRSConfiguration, CQRSComponents } from './cqrs-factory';
