import {
  DomainEvent,
  DomainEventHandler,
  DomainEventSubscription,
} from './domain-event';
import { EventStore } from './event-store';
import { logger } from '@/infrastructure/logging/logger';

export interface DomainEventBus {
  publish(event: DomainEvent): Promise<void>;
  publishMany(events: DomainEvent[]): Promise<void>;
  subscribe<T extends DomainEvent>(
    eventType: new (...args: any[]) => T,
    handler: DomainEventHandler<T>
  ): DomainEventSubscription;
  subscribeToAll(handler: DomainEventHandler): DomainEventSubscription;
  unsubscribe(subscription: DomainEventSubscription): void;
  clear(): void;
  getMetrics(): EventBusMetrics;
}

export interface EventBusMetrics {
  totalEventsPublished: number;
  totalEventsHandled: number;
  totalEventsFailed: number;
  activeSubscriptions: number;
  averageHandlingTime: number;
}

export class InMemoryDomainEventBus implements DomainEventBus {
  private handlers = new Map<string, DomainEventHandler[]>();
  private globalHandlers: DomainEventHandler[] = [];
  private eventStore?: EventStore;
  private metrics: EventBusMetrics = {
    totalEventsPublished: 0,
    totalEventsHandled: 0,
    totalEventsFailed: 0,
    activeSubscriptions: 0,
    averageHandlingTime: 0,
  };
  private handlingTimes: number[] = [];

  constructor(eventStore?: EventStore) {
    this.eventStore = eventStore;
  }

  async publish(event: DomainEvent): Promise<void> {
    const startTime = Date.now();
    this.metrics.totalEventsPublished++;

    try {
      // Store event if event store is available
      if (this.eventStore) {
        await this.eventStore.append(event);
      }

      // Get specific handlers for this event type
      const specificHandlers = this.handlers.get(event.eventName) || [];

      // Combine with global handlers
      const allHandlers = [...specificHandlers, ...this.globalHandlers];

      if (allHandlers.length === 0) {
        logger.debug('No handlers found for event', {
          eventName: event.eventName,
          eventId: event.eventId,
        });
        return;
      }

      // Execute all handlers in parallel with error isolation
      const handlerPromises = allHandlers.map(async handler => {
        try {
          if (handler.canHandle(event)) {
            await handler.handle(event);
            this.metrics.totalEventsHandled++;
          }
        } catch (error) {
          this.metrics.totalEventsFailed++;
          logger.error('Error handling domain event', {
            error: error instanceof Error ? error.message : String(error),
            eventName: event.eventName,
            eventId: event.eventId,
            handlerName: handler.constructor.name,
            stack: error instanceof Error ? error.stack : undefined,
          });

          // Don't rethrow - we want to isolate handler failures
        }
      });

      await Promise.allSettled(handlerPromises);

      // Update metrics
      const handlingTime = Date.now() - startTime;
      this.handlingTimes.push(handlingTime);

      // Keep only last 100 handling times for average calculation
      if (this.handlingTimes.length > 100) {
        this.handlingTimes.shift();
      }

      this.metrics.averageHandlingTime =
        this.handlingTimes.reduce((sum, time) => sum + time, 0) /
        this.handlingTimes.length;

      logger.debug('Domain event published and handled', {
        eventName: event.eventName,
        eventId: event.eventId,
        handlerCount: allHandlers.length,
        handlingTime,
      });
    } catch (error) {
      this.metrics.totalEventsFailed++;
      logger.error('Error publishing domain event', {
        error: error instanceof Error ? error.message : String(error),
        eventName: event.eventName,
        eventId: event.eventId,
      });
      throw error;
    }
  }

  async publishMany(events: DomainEvent[]): Promise<void> {
    if (events.length === 0) return;

    logger.debug('Publishing multiple domain events', {
      eventCount: events.length,
      eventTypes: [...new Set(events.map(e => e.eventName))],
    });

    // Publish events in parallel for better performance
    await Promise.all(events.map(event => this.publish(event)));
  }

  subscribe<T extends DomainEvent>(
    eventType: new (...args: any[]) => T,
    handler: DomainEventHandler<T>
  ): DomainEventSubscription {
    const eventName = eventType.name;

    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }

    this.handlers.get(eventName)!.push(handler as DomainEventHandler);
    this.metrics.activeSubscriptions++;

    logger.debug('Subscribed to domain event', {
      eventName,
      handlerName: handler.constructor.name,
    });

    return {
      unsubscribe: () => {
        const eventHandlers = this.handlers.get(eventName);
        if (eventHandlers) {
          const index = eventHandlers.indexOf(handler as DomainEventHandler);
          if (index > -1) {
            eventHandlers.splice(index, 1);
            this.metrics.activeSubscriptions--;

            logger.debug('Unsubscribed from domain event', {
              eventName,
              handlerName: handler.constructor.name,
            });
          }
        }
      },
    };
  }

  subscribeToAll(handler: DomainEventHandler): DomainEventSubscription {
    this.globalHandlers.push(handler);
    this.metrics.activeSubscriptions++;

    logger.debug('Subscribed to all domain events', {
      handlerName: handler.constructor.name,
    });

    return {
      unsubscribe: () => {
        const index = this.globalHandlers.indexOf(handler);
        if (index > -1) {
          this.globalHandlers.splice(index, 1);
          this.metrics.activeSubscriptions--;

          logger.debug('Unsubscribed from all domain events', {
            handlerName: handler.constructor.name,
          });
        }
      },
    };
  }

  unsubscribe(subscription: DomainEventSubscription): void {
    subscription.unsubscribe();
  }

  clear(): void {
    this.handlers.clear();
    this.globalHandlers = [];
    this.metrics.activeSubscriptions = 0;

    logger.info('Domain event bus cleared');
  }

  getMetrics(): EventBusMetrics {
    return { ...this.metrics };
  }

  // Additional utility methods
  getSubscriptionCount(eventName?: string): number {
    if (eventName) {
      return (this.handlers.get(eventName) || []).length;
    }

    let total = this.globalHandlers.length;
    for (const handlers of this.handlers.values()) {
      total += handlers.length;
    }
    return total;
  }

  getRegisteredEventTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  hasHandlers(eventName: string): boolean {
    const specificHandlers = this.handlers.get(eventName) || [];
    return specificHandlers.length > 0 || this.globalHandlers.length > 0;
  }
}
