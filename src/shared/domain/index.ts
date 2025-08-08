/**
 * Shared Domain Layer Exports
 * This module exports all shared domain components for use across domains
 */

// Base classes and interfaces
export { BaseEntity } from './base-entity';
export {
  ValueObject,
  SingleValueObject,
  Email,
  PhoneNumber,
  Money,
} from './value-object';
export {
  DomainEvent,
  BaseDomainEvent,
  DomainEventHandler,
  DomainEventBus,
} from './domain-event';

// Repository patterns
export {
  Repository,
  ExtendedRepository,
  BaseRepository,
  PaginatedResult,
  Specification,
  SpecificationRepository,
} from './repository';

// Specification pattern
export {
  Specification as SpecificationBase,
  TrueSpecification,
  FalseSpecification,
  PropertyEqualsSpecification,
  PropertyInSpecification,
  PropertyGreaterThanSpecification,
  PropertyLessThanSpecification,
  DateAfterSpecification,
  DateBeforeSpecification,
  PredicateSpecification,
} from './specification';

// Error handling
export {
  DomainError,
  EntityNotFoundError,
  BusinessRuleViolationError,
  ValidationError,
  OperationNotPermittedError,
  ConflictError,
  InvariantViolationError,
  InvalidAggregateStateError,
  ConcurrencyError,
} from './errors/domain-error';
