import {
  DomainEvent,
  DomainEventHandler,
  DomainEventBus,
} from './domain-event';

/**
 * Domain event publisher that manages event handlers and publishing
 */
export class DomainEventPublisher implements DomainEventBus {
  private static instance: DomainEventPublisher;
  private handlers: Map<string, DomainEventHandler[]> = new Map();
  private isPublishing = false;

  private constructor() {}

  /**
   * Gets the singleton instance of the domain event publisher
   */
  static getInstance(): DomainEventPublisher {
    if (!DomainEventPublisher.instance) {
      DomainEventPublisher.instance = new DomainEventPublisher();
    }
    return DomainEventPublisher.instance;
  }

  /**
   * Subscribes a handler to a specific event type
   */
  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: DomainEventHandler<T>
  ): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler as DomainEventHandler);
  }

  /**
   * Unsubscribes a handler from a specific event type
   */
  unsubscribe<T extends DomainEvent>(
    eventType: string,
    handler: DomainEventHandler<T>
  ): void {
    const eventHandlers = this.handlers.get(eventType);
    if (eventHandlers) {
      const index = eventHandlers.indexOf(handler as DomainEventHandler);
      if (index !== -1) {
        eventHandlers.splice(index, 1);
      }
    }
  }

  /**
   * Publishes a single domain event
   */
  async publish(event: DomainEvent): Promise<void> {
    if (this.isPublishing) {
      // Prevent recursive publishing
      return;
    }

    this.isPublishing = true;
    try {
      const handlers = this.handlers.get(event.eventType) || [];

      // Execute all handlers in parallel
      await Promise.all(
        handlers.map(async handler => {
          try {
            await handler.handle(event);
          } catch (error) {
            console.error(
              `Error handling domain event ${event.eventType}:`,
              error
            );
            // Don't throw to prevent one handler failure from affecting others
          }
        })
      );
    } finally {
      this.isPublishing = false;
    }
  }

  /**
   * Publishes multiple domain events
   */
  async publishAll(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  /**
   * Clears all event handlers (useful for testing)
   */
  clearHandlers(): void {
    this.handlers.clear();
  }

  /**
   * Gets all registered event types
   */
  getRegisteredEventTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Gets the number of handlers for a specific event type
   */
  getHandlerCount(eventType: string): number {
    return this.handlers.get(eventType)?.length || 0;
  }
}

/**
 * Decorator for marking methods as domain event handlers
 */
export function DomainEventHandlerDecorator(eventType: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    // Register the handler with the publisher
    const publisher = DomainEventPublisher.getInstance();
    publisher.subscribe(eventType, {
      handle: originalMethod.bind(target),
    });

    return descriptor;
  };
}

/**
 * Interface for aggregate repositories that need to publish domain events
 */
export interface DomainEventAwareRepository<T> {
  save(aggregate: T): Promise<void>;
  saveAndPublishEvents(aggregate: T): Promise<void>;
}

/**
 * Base implementation for repositories that handle domain events
 */
export abstract class BaseDomainEventAwareRepository<
  T extends { domainEvents: DomainEvent[]; clearEvents(): void },
> implements DomainEventAwareRepository<T>
{
  constructor(protected readonly eventPublisher: DomainEventBus) {}

  abstract save(aggregate: T): Promise<void>;

  /**
   * Saves the aggregate and publishes its domain events
   */
  async saveAndPublishEvents(aggregate: T): Promise<void> {
    // Save the aggregate first
    await this.save(aggregate);

    // Then publish events
    const events = aggregate.domainEvents;
    if (events.length > 0) {
      await this.eventPublisher.publishAll(events);
      aggregate.clearEvents();
    }
  }
}
