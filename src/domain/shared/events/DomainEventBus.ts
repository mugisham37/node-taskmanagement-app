import { DomainEvent } from './DomainEvent';

export interface IDomainEventHandler<T extends DomainEvent> {
  handle(event: T): Promise<void>;
}

export interface IDomainEventBus {
  publish<T extends DomainEvent>(event: T): Promise<void>;
  publishMany(events: DomainEvent[]): Promise<void>;
  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: IDomainEventHandler<T>
  ): void;
  unsubscribe<T extends DomainEvent>(
    eventType: string,
    handler: IDomainEventHandler<T>
  ): void;
  clear(): void;
}

export class DomainEventBus implements IDomainEventBus {
  private handlers: Map<string, IDomainEventHandler<any>[]> = new Map();
  private publishedEvents: DomainEvent[] = [];

  public async publish<T extends DomainEvent>(event: T): Promise<void> {
    this.publishedEvents.push(event);

    const eventHandlers = this.handlers.get(event.eventName) || [];

    // Execute all handlers in parallel
    const promises = eventHandlers.map(handler =>
      this.executeHandler(handler, event)
    );

    await Promise.allSettled(promises);
  }

  public async publishMany(events: DomainEvent[]): Promise<void> {
    const promises = events.map(event => this.publish(event));
    await Promise.allSettled(promises);
  }

  public subscribe<T extends DomainEvent>(
    eventType: string,
    handler: IDomainEventHandler<T>
  ): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }

    const eventHandlers = this.handlers.get(eventType)!;
    if (!eventHandlers.includes(handler)) {
      eventHandlers.push(handler);
    }
  }

  public unsubscribe<T extends DomainEvent>(
    eventType: string,
    handler: IDomainEventHandler<T>
  ): void {
    const eventHandlers = this.handlers.get(eventType);
    if (eventHandlers) {
      const index = eventHandlers.indexOf(handler);
      if (index > -1) {
        eventHandlers.splice(index, 1);
      }
    }
  }

  public clear(): void {
    this.handlers.clear();
    this.publishedEvents = [];
  }

  public getPublishedEvents(): DomainEvent[] {
    return [...this.publishedEvents];
  }

  public getHandlerCount(eventType: string): number {
    return this.handlers.get(eventType)?.length || 0;
  }

  private async executeHandler<T extends DomainEvent>(
    handler: IDomainEventHandler<T>,
    event: T
  ): Promise<void> {
    try {
      await handler.handle(event);
    } catch (error) {
      // Log error but don't throw to prevent one handler from affecting others
      console.error(`Error handling domain event ${event.eventName}:`, error);

      // In production, you might want to:
      // 1. Log to monitoring system
      // 2. Add to dead letter queue
      // 3. Send alerts
    }
  }
}

// Decorator for automatic event handler registration
export function DomainEventHandler(eventType: string) {
  return function <T extends IDomainEventHandler<any>>(constructor: T) {
    // This would be used with a DI container to automatically register handlers
    (constructor as any).eventType = eventType;
    return constructor;
  };
}

// Base class for domain event handlers
export abstract class BaseDomainEventHandler<T extends DomainEvent>
  implements IDomainEventHandler<T>
{
  public abstract handle(event: T): Promise<void>;

  protected logHandling(event: T): void {
    console.log(`Handling domain event: ${event.eventName}`, {
      eventId: event.eventId,
      occurredAt: event.occurredAt,
      data: event.data,
    });
  }

  protected logError(event: T, error: Error): void {
    console.error(`Error handling domain event: ${event.eventName}`, {
      eventId: event.eventId,
      error: error.message,
      stack: error.stack,
    });
  }
}
