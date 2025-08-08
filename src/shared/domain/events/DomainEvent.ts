import {
  DomainEvent as CoreDomainEvent,
  BaseDomainEvent,
} from '../domain-event';

/**
 * Re-export DomainEvent for backward compatibility
 */
export interface DomainEvent extends CoreDomainEvent {}

/**
 * Re-export BaseDomainEvent for backward compatibility
 */
export { BaseDomainEvent as DomainEvent } from '../domain-event';
