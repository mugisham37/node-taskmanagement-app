import { DomainEvent } from './domain-event';

/**
 * Interface for domain event handlers
 */
export interface IDomainEventHandler<T extends DomainEvent> {
  handle(event: T): Promise<void>;
}

/**
 * Domain event publisher for publishing and handling domain events
 */
export class DomainEventPublisher {
  private static instance: DomainEventPublisher;
  private handlers: Map<string, IDomainEventHandler<any>[]> = new Map();
  private isPublishing = false;

  private constructor() {}

  static getInstance(): DomainEventPublisher {
    if (!DomainEventPublisher.instance) {
      DomainEventPublisher.instance = new DomainEventPublisher();
    }
    return DomainEventPublisher.instance;
  }

  /**
   * Register an event handler for a specific event type
   */
  register<T extends DomainEvent>(
    eventName: string,
    handler: IDomainEventHandler<T>
  ): void {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }
    this.handlers.get(eventName)!.push(handler);
  }

  /**
   * Publish a single domain event
   */
  async publish(event: DomainEvent): Promise<void> {
    const eventName = event.getEventName();
    const eventHandlers = this.handlers.get(eventName) || [];

    for (const handler of eventHandlers) {
      try {
        await handler.handle(event);
      } catch (error) {
        console.error(`Error handling event ${eventName}:`, error);
        // In production, you might want to use a proper logger
        // and potentially implement retry logic or dead letter queues
      }
    }
  }

  /**
   * Publish multiple domain events
   */
  async publishAll(events: DomainEvent[]): Promise<void> {
    if (this.isPublishing) {
      return; // Prevent recursive publishing
    }

    this.isPublishing = true;
    try {
      for (const event of events) {
        await this.publish(event);
      }
    } finally {
      this.isPublishing = false;
    }
  }

  /**
   * Clear all registered handlers (useful for testing)
   */
  clearHandlers(): void {
    this.handlers.clear();
  }

  /**
   * Get all registered event types
   */
  getRegisteredEventTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
}
