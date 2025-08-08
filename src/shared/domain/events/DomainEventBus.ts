import {
  DomainEventBus as CoreDomainEventBus,
  InMemoryDomainEventBus,
} from './domain-event-bus';
import { DomainEvent, DomainEventHandler } from './domain-event';

/**
 * Re-export DomainEventBus for backward compatibility
 */
export interface DomainEventBus extends CoreDomainEventBus {}

/**
 * Re-export InMemoryDomainEventBus for backward compatibility
 */
export { InMemoryDomainEventBus } from './domain-event-bus';

/**
 * Base domain event handler for backward compatibility
 */
export abstract class BaseDomainEventHandler<
  T extends DomainEvent = DomainEvent,
> implements DomainEventHandler<T>
{
  abstract handle(event: T): Promise<void>;
}

/**
 * Re-export DomainEventHandler for backward compatibility
 */
export interface DomainEventHandler<T extends DomainEvent = DomainEvent> {
  handle(event: T): Promise<void>;
}
