// Base domain components
export * from './base-entity';
export * from './value-object';
export * from './domain-event';
export * from './event-bus';
export * from './repository';
export * from './base-service';

// Domain errors
export * from '../errors/domain-error';

// Common value objects
export {
  Email,
  Url,
  Money,
  SimpleValueObject,
  type MoneyProps,
} from './value-object';

// Event system
export {
  getEventBus,
  setEventBus,
  resetEventBus,
  InMemoryDomainEventBus,
} from './event-bus';

// Service utilities
export {
  ValidationRules,
  ServiceResult,
  type ValidationRule,
} from './base-service';
