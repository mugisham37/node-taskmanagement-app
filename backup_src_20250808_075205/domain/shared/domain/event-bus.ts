import {
  DomainEvent,
  DomainEventBus,
  DomainEventHandler,
} from './domain-event';
import { logger } from '@/infrastructure/logging/logger';

/**
 * In-memory implementation of the domain event bus
 * This is a simple implementation for development and testing
 * In production, you might want to use a more robust message broker
 */
export class InMemoryDomainEventBus implements DomainEventBus {
  private handlers = new Map<string, DomainEventHandler[]>();
  private isProcessing = false;
  private eventQueue: DomainEvent[] = [];

  /**
   * Publish a single event
   */
  async publish(event: DomainEvent): Promise<void> {
    logger.debug('Publishing domain event', {
      eventId: event.eventId,
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
    });

    this.eventQueue.push(event);

    if (!this.isProcessing) {
      await this.processQueue();
    }
  }

  /**
   * Publish multiple events
   */
  async publishAll(events: DomainEvent[]): Promise<void> {
    logger.debug('Publishing multiple domain events', {
      eventCount: events.length,
      eventTypes: events.map(e => e.eventType),
    });

    this.eventQueue.push(...events);

    if (!this.isProcessing) {
      await this.processQueue();
    }
  }

  /**
   * Subscribe to events
   */
  async subscribe<T extends DomainEvent>(
    eventType: string,
    handler: DomainEventHandler<T>
  ): Promise<void> {
    logger.debug('Subscribing to domain event', {
      eventType,
      handlerName: handler.constructor.name,
    });

    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }

    const handlers = this.handlers.get(eventType)!;

    // Check if handler is already subscribed
    if (!handlers.includes(handler as DomainEventHandler)) {
      handlers.push(handler as DomainEventHandler);

      // Sort handlers by priority if they have one
      handlers.sort((a, b) => {
        const priorityA = a.getPriority?.() ?? 100;
        const priorityB = b.getPriority?.() ?? 100;
        return priorityA - priorityB;
      });
    }
  }

  /**
   * Unsubscribe from events
   */
  async unsubscribe(
    eventType: string,
    handler: DomainEventHandler
  ): Promise<void> {
    logger.debug('Unsubscribing from domain event', {
      eventType,
      handlerName: handler.constructor.name,
    });

    const handlers = this.handlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }

      // Remove empty handler arrays
      if (handlers.length === 0) {
        this.handlers.delete(eventType);
      }
    }
  }

  /**
   * Clear all subscriptions
   */
  async clear(): Promise<void> {
    logger.debug('Clearing all domain event subscriptions');
    this.handlers.clear();
    this.eventQueue = [];
  }

  /**
   * Process the event queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.eventQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift()!;
        await this.processEvent(event);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single event
   */
  private async processEvent(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventType) || [];

    if (handlers.length === 0) {
      logger.debug('No handlers found for event type', {
        eventType: event.eventType,
        eventId: event.eventId,
      });
      return;
    }

    logger.debug('Processing domain event', {
      eventId: event.eventId,
      eventType: event.eventType,
      handlerCount: handlers.length,
    });

    // Process handlers in parallel
    const handlerPromises = handlers.map(async handler => {
      try {
        const startTime = Date.now();
        await handler.handle(event);
        const duration = Date.now() - startTime;

        logger.debug('Domain event handler completed', {
          eventId: event.eventId,
          eventType: event.eventType,
          handlerName: handler.constructor.name,
          duration,
        });
      } catch (error) {
        logger.error('Domain event handler failed', {
          eventId: event.eventId,
          eventType: event.eventType,
          handlerName: handler.constructor.name,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        });

        // Don't throw here to prevent one handler failure from affecting others
        // In production, you might want to implement retry logic or dead letter queues
      }
    });

    await Promise.all(handlerPromises);
  }

  /**
   * Get statistics about the event bus
   */
  public getStats(): {
    subscribedEventTypes: string[];
    totalHandlers: number;
    queuedEvents: number;
    isProcessing: boolean;
  } {
    const subscribedEventTypes = Array.from(this.handlers.keys());
    const totalHandlers = Array.from(this.handlers.values()).reduce(
      (total, handlers) => total + handlers.length,
      0
    );

    return {
      subscribedEventTypes,
      totalHandlers,
      queuedEvents: this.eventQueue.length,
      isProcessing: this.isProcessing,
    };
  }
}

/**
 * Singleton instance of the event bus
 */
let eventBusInstance: DomainEventBus | null = null;

/**
 * Get the singleton event bus instance
 */
export function getEventBus(): DomainEventBus {
  if (!eventBusInstance) {
    eventBusInstance = new InMemoryDomainEventBus();
  }
  return eventBusInstance;
}

/**
 * Set a custom event bus implementation
 */
export function setEventBus(eventBus: DomainEventBus): void {
  eventBusInstance = eventBus;
}

/**
 * Reset the event bus (useful for testing)
 */
export function resetEventBus(): void {
  eventBusInstance = null;
}
