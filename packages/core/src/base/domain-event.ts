import { DomainEvent, EventHandler } from '../types/event.interface';

/**
 * Base domain event class
 */
export abstract class BaseDomainEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly eventVersion: number;

  constructor(eventId: string, eventVersion: number = 1) {
    this.eventId = eventId;
    this.occurredOn = new Date();
    this.eventVersion = eventVersion;
  }
}

/**
 * Domain event dispatcher interface
 */
export interface DomainEventDispatcher {
  dispatch<T extends DomainEvent>(event: T): Promise<void>;
  register<T extends DomainEvent>(eventType: string, handler: EventHandler<T>): void;
  unregister(eventType: string, handler: EventHandler): void;
}

/**
 * Simple in-memory domain event dispatcher
 */
export class InMemoryDomainEventDispatcher implements DomainEventDispatcher {
  private handlers = new Map<string, EventHandler[]>();

  async dispatch<T extends DomainEvent>(event: T): Promise<void> {
    const eventType = event.constructor.name;
    const eventHandlers = this.handlers.get(eventType) || [];

    for (const handler of eventHandlers) {
      try {
        await handler.handle(event);
      } catch (error) {
        console.error(`Error handling event ${eventType}:`, error);
        // In a real implementation, you might want to have a more sophisticated error handling strategy
      }
    }
  }

  register<T extends DomainEvent>(eventType: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler as EventHandler);
  }

  unregister(eventType: string, handler: EventHandler): void {
    const eventHandlers = this.handlers.get(eventType);
    if (eventHandlers) {
      const index = eventHandlers.indexOf(handler);
      if (index > -1) {
        eventHandlers.splice(index, 1);
      }
    }
  }
}