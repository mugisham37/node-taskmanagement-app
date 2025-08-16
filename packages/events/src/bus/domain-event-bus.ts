/**
 * Enhanced Domain Event Bus
 *
 * This module provides a comprehensive domain event bus implementation with
 * advanced features like error handling, retry mechanisms, and performance monitoring.
 */

import { injectable, LoggingService } from '@taskmanagement/core';
import { DomainEvent } from '@taskmanagement/domain';
import { PerformanceMonitor } from '@taskmanagement/utils';

export interface EventHandler<T extends DomainEvent = DomainEvent> {
  handle(event: T): Promise<void>;
  canHandle(event: DomainEvent): boolean;
  priority?: number; // Higher priority handlers execute first
}

export interface EventSubscription {
  unsubscribe(): void;
  isActive(): boolean;
}

export interface IDomainEventBus {
  publish(event: DomainEvent): Promise<void>;
  publishAll(events: DomainEvent[]): Promise<void>;
  subscribe<T extends DomainEvent>(eventName: string, handler: EventHandler<T>): EventSubscription;
  unsubscribe(eventName: string, handler: EventHandler): void;
  clear(): void;
  getSubscriptionStats(): Promise<SubscriptionStats>;
  healthCheck(): Promise<void>;
  clearSubscriptions(): Promise<void>;
  getPerformanceMetrics(): Record<string, any>;
}

export interface SubscriptionStats {
  handlerCount: number;
  subscriptionCount: number;
  eventTypes: string[];
}

export interface EventProcessingOptions {
  enableRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  enableParallelProcessing?: boolean;
  enableMetrics?: boolean;
}

@injectable()
export class DomainEventBus implements IDomainEventBus {
  private handlers = new Map<string, EventHandler[]>();
  private subscriptions = new Map<string, EventSubscription[]>();
  private performanceMonitor = new PerformanceMonitor();
  private isHealthy = true;

  constructor(
    private readonly logger: LoggingService,
    private readonly options: EventProcessingOptions = {}
  ) {
    this.options = {
      enableRetry: true,
      maxRetries: 3,
      retryDelay: 1000,
      enableParallelProcessing: true,
      enableMetrics: true,
      ...options,
    };
  }

  async publish(event: DomainEvent): Promise<void> {
    const eventName = event.getEventName();
    const eventHandlers = this.handlers.get(eventName) || [];

    if (eventHandlers.length === 0) {
      this.logger.debug(`No handlers registered for event: ${eventName}`, {
        eventId: event.getEventId(),
        eventName,
      });
      return;
    }

    this.logger.info(`Publishing event: ${eventName}`, {
      eventId: event.getEventId(),
      eventName,
      handlerCount: eventHandlers.length,
    });

    const timer = this.performanceMonitor.startTimer(`event.${eventName}`);

    try {
      // Sort handlers by priority (higher first)
      const sortedHandlers = eventHandlers.sort((a, b) => (b.priority || 0) - (a.priority || 0));

      if (this.options.enableParallelProcessing) {
        // Execute all handlers in parallel
        await Promise.allSettled(
          sortedHandlers.map((handler) => this.executeHandler(handler, event))
        );
      } else {
        // Execute handlers sequentially
        for (const handler of sortedHandlers) {
          await this.executeHandler(handler, event);
        }
      }

      const duration = timer.end();

      this.logger.info(`Event published successfully: ${eventName}`, {
        eventId: event.getEventId(),
        eventName,
        duration,
        handlerCount: eventHandlers.length,
      });

      if (this.options.enableMetrics) {
        this.performanceMonitor.recordMetric(`event.${eventName}.success`, 1);
        this.performanceMonitor.recordMetric(`event.${eventName}.duration`, duration);
        this.performanceMonitor.recordMetric(`event.${eventName}.handlers`, eventHandlers.length);
      }
    } catch (error) {
      const duration = timer.end();

      this.logger.error(`Event publishing failed: ${eventName}`, error as Error, {
        eventId: event.getEventId(),
        eventName,
        duration,
      });

      if (this.options.enableMetrics) {
        this.performanceMonitor.recordMetric(`event.${eventName}.error`, 1);
      }

      throw error;
    }
  }

  async publishAll(events: DomainEvent[]): Promise<void> {
    this.logger.info(`Publishing ${events.length} events`);

    const timer = this.performanceMonitor.startTimer('event.publishAll');

    try {
      if (this.options.enableParallelProcessing) {
        await Promise.allSettled(events.map((event) => this.publish(event)));
      } else {
        for (const event of events) {
          await this.publish(event);
        }
      }

      const duration = timer.end();

      this.logger.info(`Completed publishing ${events.length} events`, {
        duration,
        eventCount: events.length,
      });

      if (this.options.enableMetrics) {
        this.performanceMonitor.recordMetric('event.publishAll.success', 1);
        this.performanceMonitor.recordMetric('event.publishAll.duration', duration);
        this.performanceMonitor.recordMetric('event.publishAll.count', events.length);
      }
    } catch (error) {
      const duration = timer.end();

      this.logger.error(`Failed to publish ${events.length} events`, error as Error, {
        duration,
        eventCount: events.length,
      });

      if (this.options.enableMetrics) {
        this.performanceMonitor.recordMetric('event.publishAll.error', 1);
      }

      throw error;
    }
  }

  subscribe<T extends DomainEvent>(eventName: string, handler: EventHandler<T>): EventSubscription {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
      this.subscriptions.set(eventName, []);
    }

    this.handlers.get(eventName)!.push(handler as EventHandler);

    const subscription: EventSubscription = {
      unsubscribe: () => this.unsubscribe(eventName, handler as EventHandler),
      isActive: () => this.handlers.get(eventName)?.includes(handler as EventHandler) || false,
    };

    this.subscriptions.get(eventName)!.push(subscription);

    this.logger.debug(`Event handler subscribed`, {
      eventName,
      handlerName: handler.constructor.name,
      priority: handler.priority || 0,
    });

    return subscription;
  }

  unsubscribe(eventName: string, handler: EventHandler): void {
    const eventHandlers = this.handlers.get(eventName);
    if (eventHandlers) {
      const index = eventHandlers.indexOf(handler);
      if (index > -1) {
        eventHandlers.splice(index, 1);

        this.logger.debug(`Event handler unsubscribed`, {
          eventName,
          handlerName: handler.constructor.name,
        });
      }
    }

    // Clean up empty handler arrays
    if (eventHandlers && eventHandlers.length === 0) {
      this.handlers.delete(eventName);
      this.subscriptions.delete(eventName);
    }
  }

  clear(): void {
    this.handlers.clear();
    this.subscriptions.clear();
    this.logger.info('All event handlers cleared');
  }

  async getSubscriptionStats(): Promise<SubscriptionStats> {
    const handlerCount = Array.from(this.handlers.values()).reduce(
      (total, handlers) => total + handlers.length,
      0
    );

    const subscriptionCount = Array.from(this.subscriptions.values()).reduce(
      (total, subs) => total + subs.length,
      0
    );

    const eventTypes = Array.from(this.handlers.keys());

    return {
      handlerCount,
      subscriptionCount,
      eventTypes,
    };
  }

  async healthCheck(): Promise<void> {
    if (!this.isHealthy) {
      throw new Error('Domain event bus is not healthy');
    }

    // Perform basic health checks
    const stats = await this.getSubscriptionStats();

    this.logger.debug('Domain event bus health check passed', {
      handlerCount: stats.handlerCount,
      subscriptionCount: stats.subscriptionCount,
      eventTypes: stats.eventTypes.length,
    });
  }

  async clearSubscriptions(): Promise<void> {
    this.clear();
    this.logger.info('All subscriptions cleared');
  }

  private async executeHandler(handler: EventHandler, event: DomainEvent): Promise<void> {
    if (!handler.canHandle(event)) {
      this.logger.debug(`Handler cannot handle event`, {
        handlerName: handler.constructor.name,
        eventName: event.getEventName(),
        eventId: event.getEventId(),
      });
      return;
    }

    const handlerName = handler.constructor.name;
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= (this.options.maxRetries || 0)) {
      try {
        const timer = this.performanceMonitor.startTimer(`handler.${handlerName}`);

        await handler.handle(event);

        const duration = timer.end();

        this.logger.debug(`Event handler completed`, {
          handlerName,
          eventName: event.getEventName(),
          eventId: event.getEventId(),
          attempt: attempt + 1,
          duration,
        });

        if (this.options.enableMetrics) {
          this.performanceMonitor.recordMetric(`handler.${handlerName}.success`, 1);
          this.performanceMonitor.recordMetric(`handler.${handlerName}.duration`, duration);
        }

        return; // Success, exit retry loop
      } catch (error) {
        lastError = error as Error;
        attempt++;

        this.logger.error(`Event handler failed`, lastError, {
          handlerName,
          eventName: event.getEventName(),
          eventId: event.getEventId(),
          attempt,
          maxRetries: this.options.maxRetries,
        });

        if (this.options.enableMetrics) {
          this.performanceMonitor.recordMetric(`handler.${handlerName}.error`, 1);
        }

        // If we haven't exceeded max retries and retry is enabled, wait and try again
        if (this.options.enableRetry && attempt <= (this.options.maxRetries || 0)) {
          await this.delay(this.options.retryDelay || 1000);
        }
      }
    }

    // If we get here, all retries failed
    this.logger.error(`Event handler failed after all retries`, lastError!, {
      handlerName,
      eventName: event.getEventName(),
      eventId: event.getEventId(),
      totalAttempts: attempt,
    });

    if (this.options.enableMetrics) {
      this.performanceMonitor.recordMetric(`handler.${handlerName}.failed`, 1);
    }

    // Don't throw the error to prevent one handler failure from affecting others
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Performance monitoring
  getPerformanceMetrics(): Record<string, any> {
    return this.performanceMonitor.getMetrics();
  }

  // Health management
  setHealthy(healthy: boolean): void {
    this.isHealthy = healthy;
    this.logger.info(`Domain event bus health status changed`, { healthy });
  }
}
