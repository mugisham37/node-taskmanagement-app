import {
  IntegrationEvent,
  IntegrationEventHandler,
  IntegrationEventSubscription,
  EventDeliveryOptions,
  EventFilter,
} from './integration-event';
import { WebhookDeliveryService } from './webhook-delivery-service';
import { logger } from '@/infrastructure/logging/logger';

export interface IntegrationEventBus {
  publish(
    event: IntegrationEvent,
    options?: EventDeliveryOptions
  ): Promise<void>;
  publishMany(
    events: IntegrationEvent[],
    options?: EventDeliveryOptions
  ): Promise<void>;
  subscribe<T extends IntegrationEvent>(
    eventType: new (...args: any[]) => T,
    handler: IntegrationEventHandler<T>,
    filter?: EventFilter
  ): IntegrationEventSubscription;
  subscribeToPattern(
    pattern: string,
    handler: IntegrationEventHandler,
    filter?: EventFilter
  ): IntegrationEventSubscription;
  unsubscribe(subscription: IntegrationEventSubscription): void;
  clear(): void;
  getMetrics(): IntegrationEventBusMetrics;
}

export interface IntegrationEventBusMetrics {
  totalEventsPublished: number;
  totalEventsHandled: number;
  totalEventsFailed: number;
  totalWebhooksDelivered: number;
  totalWebhooksFailed: number;
  activeSubscriptions: number;
  averageHandlingTime: number;
}

interface Subscription {
  id: string;
  handler: IntegrationEventHandler;
  filter?: EventFilter;
  eventType?: string;
  pattern?: string;
}

export class DefaultIntegrationEventBus implements IntegrationEventBus {
  private subscriptions = new Map<string, Subscription>();
  private webhookService: WebhookDeliveryService;
  private metrics: IntegrationEventBusMetrics = {
    totalEventsPublished: 0,
    totalEventsHandled: 0,
    totalEventsFailed: 0,
    totalWebhooksDelivered: 0,
    totalWebhooksFailed: 0,
    activeSubscriptions: 0,
    averageHandlingTime: 0,
  };
  private handlingTimes: number[] = [];
  private nextSubscriptionId = 1;

  constructor(webhookService: WebhookDeliveryService) {
    this.webhookService = webhookService;
  }

  async publish(
    event: IntegrationEvent,
    options?: EventDeliveryOptions
  ): Promise<void> {
    const startTime = Date.now();
    this.metrics.totalEventsPublished++;

    try {
      logger.info('Publishing integration event', {
        eventId: event.eventId,
        eventName: event.eventName,
        eventVersion: event.eventVersion,
        routingKey: event.getRoutingKey(),
        source: event.source,
      });

      // Find matching subscriptions
      const matchingSubscriptions = this.findMatchingSubscriptions(event);

      // Handle event with internal handlers
      const handlerPromises = matchingSubscriptions.map(async subscription => {
        try {
          if (subscription.handler.canHandle(event)) {
            await subscription.handler.handle(event);
            this.metrics.totalEventsHandled++;
          }
        } catch (error) {
          this.metrics.totalEventsFailed++;
          logger.error('Error handling integration event', {
            error: error instanceof Error ? error.message : String(error),
            eventId: event.eventId,
            eventName: event.eventName,
            handlerName: subscription.handler.constructor.name,
            subscriptionId: subscription.id,
          });
        }
      });

      // Deliver via webhooks
      const webhookPromise = this.deliverWebhooks(event, options);

      // Wait for all handlers and webhook delivery
      await Promise.allSettled([...handlerPromises, webhookPromise]);

      // Update metrics
      const handlingTime = Date.now() - startTime;
      this.handlingTimes.push(handlingTime);

      if (this.handlingTimes.length > 100) {
        this.handlingTimes.shift();
      }

      this.metrics.averageHandlingTime =
        this.handlingTimes.reduce((sum, time) => sum + time, 0) /
        this.handlingTimes.length;

      logger.debug('Integration event published and handled', {
        eventId: event.eventId,
        handlerCount: matchingSubscriptions.length,
        handlingTime,
      });
    } catch (error) {
      this.metrics.totalEventsFailed++;
      logger.error('Error publishing integration event', {
        error: error instanceof Error ? error.message : String(error),
        eventId: event.eventId,
        eventName: event.eventName,
      });
      throw error;
    }
  }

  async publishMany(
    events: IntegrationEvent[],
    options?: EventDeliveryOptions
  ): Promise<void> {
    if (events.length === 0) return;

    logger.info('Publishing multiple integration events', {
      eventCount: events.length,
      eventTypes: [...new Set(events.map(e => e.eventName))],
    });

    // Publish events in parallel for better performance
    await Promise.all(events.map(event => this.publish(event, options)));
  }

  subscribe<T extends IntegrationEvent>(
    eventType: new (...args: any[]) => T,
    handler: IntegrationEventHandler<T>,
    filter?: EventFilter
  ): IntegrationEventSubscription {
    const subscriptionId = this.nextSubscriptionId.toString();
    this.nextSubscriptionId++;

    const subscription: Subscription = {
      id: subscriptionId,
      handler: handler as IntegrationEventHandler,
      filter,
      eventType: eventType.name,
    };

    this.subscriptions.set(subscriptionId, subscription);
    this.metrics.activeSubscriptions++;

    logger.debug('Subscribed to integration event', {
      subscriptionId,
      eventType: eventType.name,
      handlerName: handler.constructor.name,
    });

    return {
      unsubscribe: () => {
        this.subscriptions.delete(subscriptionId);
        this.metrics.activeSubscriptions--;

        logger.debug('Unsubscribed from integration event', {
          subscriptionId,
          eventType: eventType.name,
        });
      },
    };
  }

  subscribeToPattern(
    pattern: string,
    handler: IntegrationEventHandler,
    filter?: EventFilter
  ): IntegrationEventSubscription {
    const subscriptionId = this.nextSubscriptionId.toString();
    this.nextSubscriptionId++;

    const subscription: Subscription = {
      id: subscriptionId,
      handler,
      filter,
      pattern,
    };

    this.subscriptions.set(subscriptionId, subscription);
    this.metrics.activeSubscriptions++;

    logger.debug('Subscribed to integration event pattern', {
      subscriptionId,
      pattern,
      handlerName: handler.constructor.name,
    });

    return {
      unsubscribe: () => {
        this.subscriptions.delete(subscriptionId);
        this.metrics.activeSubscriptions--;

        logger.debug('Unsubscribed from integration event pattern', {
          subscriptionId,
          pattern,
        });
      },
    };
  }

  unsubscribe(subscription: IntegrationEventSubscription): void {
    subscription.unsubscribe();
  }

  clear(): void {
    this.subscriptions.clear();
    this.metrics.activeSubscriptions = 0;

    logger.info('Integration event bus cleared');
  }

  getMetrics(): IntegrationEventBusMetrics {
    const webhookMetrics = this.webhookService.getMetrics();

    return {
      ...this.metrics,
      totalWebhooksDelivered: webhookMetrics.totalDelivered,
      totalWebhooksFailed: webhookMetrics.totalFailed,
    };
  }

  private findMatchingSubscriptions(event: IntegrationEvent): Subscription[] {
    const matchingSubscriptions: Subscription[] = [];

    for (const subscription of this.subscriptions.values()) {
      // Check event type match
      if (
        subscription.eventType &&
        subscription.eventType !== event.eventName
      ) {
        continue;
      }

      // Check pattern match
      if (
        subscription.pattern &&
        !this.matchesPattern(event.getRoutingKey(), subscription.pattern)
      ) {
        continue;
      }

      // Apply filter if present
      if (
        subscription.filter &&
        !this.passesFilter(event, subscription.filter)
      ) {
        continue;
      }

      matchingSubscriptions.push(subscription);
    }

    return matchingSubscriptions;
  }

  private matchesPattern(routingKey: string, pattern: string): boolean {
    // Simple pattern matching - could be enhanced with more sophisticated logic
    const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
    return regex.test(routingKey);
  }

  private passesFilter(event: IntegrationEvent, filter: EventFilter): boolean {
    // Check event types
    if (filter.eventTypes && !filter.eventTypes.includes(event.eventName)) {
      return false;
    }

    // Check event versions
    if (
      filter.eventVersions &&
      !filter.eventVersions.includes(event.eventVersion)
    ) {
      return false;
    }

    // Check sources
    if (filter.sources && !filter.sources.includes(event.source.service)) {
      return false;
    }

    // Check routing keys
    if (
      filter.routingKeys &&
      !filter.routingKeys.includes(event.getRoutingKey())
    ) {
      return false;
    }

    // Apply custom filter
    if (filter.customFilter && !filter.customFilter(event)) {
      return false;
    }

    return true;
  }

  private async deliverWebhooks(
    event: IntegrationEvent,
    options?: EventDeliveryOptions
  ): Promise<void> {
    try {
      await this.webhookService.deliverEvent(event, options);
    } catch (error) {
      logger.error('Error delivering webhook for integration event', {
        error: error instanceof Error ? error.message : String(error),
        eventId: event.eventId,
        eventName: event.eventName,
      });
    }
  }

  // Utility methods
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  getSubscriptions(): Array<{
    id: string;
    eventType?: string;
    pattern?: string;
    handlerName: string;
  }> {
    return Array.from(this.subscriptions.values()).map(sub => ({
      id: sub.id,
      eventType: sub.eventType,
      pattern: sub.pattern,
      handlerName: sub.handler.constructor.name,
    }));
  }
}
