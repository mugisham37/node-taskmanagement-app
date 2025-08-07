import { DomainEvent } from './domain-event';

export interface DomainEventHandler<T extends DomainEvent = DomainEvent> {
  handle(event: T): Promise<void>;
}

export interface DomainEventBus {
  publish<T extends DomainEvent>(event: T): Promise<void>;
  subscribe<T extends DomainEvent>(
    eventName: string,
    handler: DomainEventHandler<T>
  ): void;
}

export class InMemoryDomainEventBus implements DomainEventBus {
  private handlers: Map<string, DomainEventHandler[]> = new Map();

  async publish<T extends DomainEvent>(event: T): Promise<void> {
    const eventHandlers = this.handlers.get(event.eventName) || [];

    for (const handler of eventHandlers) {
      try {
        await handler.handle(event);
      } catch (error) {
        console.error(`Error handling domain event ${event.eventName}:`, error);
      }
    }
  }

  subscribe<T extends DomainEvent>(
    eventName: string,
    handler: DomainEventHandler<T>
  ): void {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }

    this.handlers.get(eventName)!.push(handler);
  }
}
