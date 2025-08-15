import { DomainEvent, EventHandler } from '../types/event.interface';

/**
 * Event bus interface for publishing and subscribing to domain events
 */
export interface EventBus {
  publish<T extends DomainEvent>(event: T): Promise<void>;
  publishMany<T extends DomainEvent>(events: T[]): Promise<void>;
  subscribe<T extends DomainEvent>(eventType: string, handler: EventHandler<T>): void;
  unsubscribe(eventType: string, handler: EventHandler): void;
}

/**
 * Simple in-memory event bus implementation
 */
export class InMemoryEventBus implements EventBus {
  private handlers = new Map<string, EventHandler[]>();

  async publish<T extends DomainEvent>(event: T): Promise<void> {
    const eventType = event.constructor.name;
    const eventHandlers = this.handlers.get(eventType) || [];

    // Execute all handlers in parallel
    const promises = eventHandlers.map(handler => 
      this.executeHandler(handler, event)
    );

    await Promise.all(promises);
  }

  async publishMany<T extends DomainEvent>(events: T[]): Promise<void> {
    const promises = events.map(event => this.publish(event));
    await Promise.all(promises);
  }

  subscribe<T extends DomainEvent>(eventType: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler as EventHandler);
  }

  unsubscribe(eventType: string, handler: EventHandler): void {
    const eventHandlers = this.handlers.get(eventType);
    if (eventHandlers) {
      const index = eventHandlers.indexOf(handler);
      if (index > -1) {
        eventHandlers.splice(index, 1);
      }
    }
  }

  private async executeHandler<T extends DomainEvent>(
    handler: EventHandler<T>,
    event: T
  ): Promise<void> {
    try {
      await handler.handle(event);
    } catch (error) {
      console.error(`Error handling event ${event.constructor.name}:`, error);
      // In a production environment, you might want to:
      // - Log the error to a monitoring system
      // - Implement retry logic
      // - Send the event to a dead letter queue
      throw error;
    }
  }

  /**
   * Get all registered event types
   */
  getRegisteredEventTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Get handler count for an event type
   */
  getHandlerCount(eventType: string): number {
    return this.handlers.get(eventType)?.length || 0;
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear();
  }
}