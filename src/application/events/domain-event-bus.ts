import { DomainEvent } from '../../../shared/domain/events/domain-event';

export interface EventHandler<T extends DomainEvent = DomainEvent> {
  handle(event: T): Promise<void>;
}

export interface EventSubscription {
  unsubscribe(): void;
}

export interface DomainEventBus {
  publish(event: DomainEvent): Promise<void>;
  publishAll(events: DomainEvent[]): Promise<void>;
  subscribe<T extends DomainEvent>(
    eventName: string,
    handler: EventHandler<T>
  ): EventSubscription;
  unsubscribe(eventName: string, handler: EventHandler): void;
  clear(): void;
}

export class InMemoryDomainEventBus implements DomainEventBus {
  private handlers = new Map<string, EventHandler[]>();

  async publish(event: DomainEvent): Promise<void> {
    const eventHandlers = this.handlers.get(event.eventName) || [];

    // Execute all handlers in parallel
    await Promise.all(
      eventHandlers.map(handler =>
        handler.handle(event).catch(error => {
          console.error(`Error handling event ${event.eventName}:`, error);
        })
      )
    );
  }

  async publishAll(events: DomainEvent[]): Promise<void> {
    await Promise.all(events.map(event => this.publish(event)));
  }

  subscribe<T extends DomainEvent>(
    eventName: string,
    handler: EventHandler<T>
  ): EventSubscription {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }

    this.handlers.get(eventName)!.push(handler as EventHandler);

    return {
      unsubscribe: () => this.unsubscribe(eventName, handler as EventHandler),
    };
  }

  unsubscribe(eventName: string, handler: EventHandler): void {
    const eventHandlers = this.handlers.get(eventName);
    if (eventHandlers) {
      const index = eventHandlers.indexOf(handler);
      if (index > -1) {
        eventHandlers.splice(index, 1);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
