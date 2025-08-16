import { LoggingService, MetricsService } from '@taskmanagement/core';
import { DomainEvent } from '@taskmanagement/domain';

/**
 * Event Subscriber Interface
 */
export interface IEventSubscriber {
  subscribe(eventType: string, handler: EventHandler): EventSubscription;
  unsubscribe(subscription: EventSubscription): void;
  unsubscribeAll(): void;
  getSubscriptions(): SubscriptionInfo[];
  isSubscribed(eventType: string): boolean;
}

/**
 * Event Handler Function Type
 */
export type EventHandler = (event: DomainEvent) => Promise<void>;

/**
 * Event Subscription Interface
 */
export interface EventSubscription {
  id: string;
  eventType: string;
  handler: EventHandler;
  isActive: boolean;
  subscribedAt: Date;
  unsubscribe(): void;
}

/**
 * Subscription Information
 */
export interface SubscriptionInfo {
  id: string;
  eventType: string;
  isActive: boolean;
  subscribedAt: Date;
  handlerName?: string;
}

/**
 * Subscriber Configuration
 */
export interface EventSubscriberConfig {
  enableMetrics?: boolean;
  enableErrorHandling?: boolean;
  maxConcurrentHandlers?: number;
  handlerTimeout?: number;
}

/**
 * Event Subscriber
 * 
 * Manages event subscriptions and handler execution with
 * proper error handling and performance monitoring.
 */
export class EventSubscriber implements IEventSubscriber {
  private subscriptions = new Map<string, EventSubscription[]>();
  private subscriptionCounter = 0;
  private handledCount = 0;
  private errorCount = 0;

  constructor(
    private readonly logger: LoggingService,
    private readonly metrics: MetricsService,
    private readonly config: EventSubscriberConfig = {}
  ) {
    this.config = {
      enableMetrics: true,
      enableErrorHandling: true,
      maxConcurrentHandlers: 10,
      handlerTimeout: 30000, // 30 seconds
      ...config,
    };
  }

  /**
   * Subscribe to an event type
   */
  subscribe(eventType: string, handler: EventHandler): EventSubscription {
    const subscriptionId = this.generateSubscriptionId();
    
    const subscription: EventSubscription = {
      id: subscriptionId,
      eventType,
      handler,
      isActive: true,
      subscribedAt: new Date(),
      unsubscribe: () => this.unsubscribe(subscription),
    };

    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, []);
    }

    this.subscriptions.get(eventType)!.push(subscription);

    this.logger.debug('Event subscription created', {
      subscriptionId,
      eventType,
      handlerName: handler.name || 'anonymous',
    });

    if (this.config.enableMetrics) {
      this.metrics.incrementCounter('event_subscriptions_total', { eventType });
    }

    return subscription;
  }

  /**
   * Unsubscribe from an event
   */
  unsubscribe(subscription: EventSubscription): void {
    const eventSubscriptions = this.subscriptions.get(subscription.eventType);
    if (!eventSubscriptions) {
      return;
    }

    const index = eventSubscriptions.findIndex(sub => sub.id === subscription.id);
    if (index > -1) {
      eventSubscriptions[index].isActive = false;
      eventSubscriptions.splice(index, 1);

      this.logger.debug('Event subscription removed', {
        subscriptionId: subscription.id,
        eventType: subscription.eventType,
      });

      if (this.config.enableMetrics) {
        this.metrics.incrementCounter('event_unsubscriptions_total', {
          eventType: subscription.eventType,
        });
      }
    }

    // Clean up empty event type arrays
    if (eventSubscriptions.length === 0) {
      this.subscriptions.delete(subscription.eventType);
    }
  }

  /**
   * Unsubscribe from all events
   */
  unsubscribeAll(): void {
    const totalSubscriptions = Array.from(this.subscriptions.values())
      .reduce((total, subs) => total + subs.length, 0);

    this.subscriptions.clear();

    this.logger.info('All event subscriptions removed', {
      totalSubscriptions,
    });

    if (this.config.enableMetrics) {
      this.metrics.incrementCounter('event_unsubscribe_all_total');
    }
  }

  /**
   * Get all subscription information
   */
  getSubscriptions(): SubscriptionInfo[] {
    const subscriptions: SubscriptionInfo[] = [];

    for (const [eventType, eventSubscriptions] of this.subscriptions) {
      for (const subscription of eventSubscriptions) {
        subscriptions.push({
          id: subscription.id,
          eventType,
          isActive: subscription.isActive,
          subscribedAt: subscription.subscribedAt,
          handlerName: subscription.handler.name || 'anonymous',
        });
      }
    }

    return subscriptions;
  }

  /**
   * Check if subscribed to an event type
   */
  isSubscribed(eventType: string): boolean {
    const subscriptions = this.subscriptions.get(eventType);
    return subscriptions ? subscriptions.length > 0 : false;
  }

  /**
   * Handle an incoming event
   */
  async handleEvent(event: DomainEvent): Promise<void> {
    const eventType = event.getEventName();
    const eventSubscriptions = this.subscriptions.get(eventType) || [];

    if (eventSubscriptions.length === 0) {
      this.logger.debug('No subscribers for event', {
        eventType,
        eventId: event.getEventId(),
      });
      return;
    }

    this.logger.debug('Handling event for subscribers', {
      eventType,
      eventId: event.getEventId(),
      subscriberCount: eventSubscriptions.length,
    });

    const startTime = Date.now();

    try {
      // Execute all handlers for this event type
      const handlerPromises = eventSubscriptions
        .filter(sub => sub.isActive)
        .map(subscription => this.executeHandler(subscription, event));

      await Promise.allSettled(handlerPromises);

      const duration = Date.now() - startTime;
      this.handledCount++;

      this.logger.debug('Event handled by all subscribers', {
        eventType,
        eventId: event.getEventId(),
        duration,
        subscriberCount: eventSubscriptions.length,
      });

      if (this.config.enableMetrics) {
        this.metrics.recordHistogram('event_handling_duration', duration);
        this.metrics.incrementCounter('events_handled_total', { eventType });
      }
    } catch (error) {
      this.errorCount++;
      this.logger.error('Error handling event', error as Error, {
        eventType,
        eventId: event.getEventId(),
      });

      if (this.config.enableMetrics) {
        this.metrics.incrementCounter('event_handling_errors_total', { eventType });
      }
    }
  }

  /**
   * Execute a single handler with timeout and error handling
   */
  private async executeHandler(
    subscription: EventSubscription,
    event: DomainEvent
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Handler timeout after ${this.config.handlerTimeout}ms`));
        }, this.config.handlerTimeout);
      });

      // Race between handler execution and timeout
      await Promise.race([
        subscription.handler(event),
        timeoutPromise,
      ]);

      const duration = Date.now() - startTime;

      this.logger.debug('Event handler completed', {
        subscriptionId: subscription.id,
        eventType: subscription.eventType,
        eventId: event.getEventId(),
        duration,
      });

      if (this.config.enableMetrics) {
        this.metrics.recordHistogram('event_handler_duration', duration);
        this.metrics.incrementCounter('event_handler_success_total', {
          eventType: subscription.eventType,
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error('Event handler failed', error as Error, {
        subscriptionId: subscription.id,
        eventType: subscription.eventType,
        eventId: event.getEventId(),
        duration,
      });

      if (this.config.enableMetrics) {
        this.metrics.incrementCounter('event_handler_error_total', {
          eventType: subscription.eventType,
        });
      }

      if (!this.config.enableErrorHandling) {
        throw error;
      }
      // If error handling is enabled, we don't rethrow to prevent
      // one handler failure from affecting others
    }
  }

  /**
   * Get subscriber metrics
   */
  getMetrics(): {
    totalSubscriptions: number;
    activeSubscriptions: number;
    eventTypes: string[];
    handledCount: number;
    errorCount: number;
  } {
    const allSubscriptions = this.getSubscriptions();
    const activeSubscriptions = allSubscriptions.filter(sub => sub.isActive);

    return {
      totalSubscriptions: allSubscriptions.length,
      activeSubscriptions: activeSubscriptions.length,
      eventTypes: Array.from(this.subscriptions.keys()),
      handledCount: this.handledCount,
      errorCount: this.errorCount,
    };
  }

  /**
   * Generate unique subscription ID
   */
  private generateSubscriptionId(): string {
    return `sub_${++this.subscriptionCounter}_${Date.now()}`;
  }

  /**
   * Shutdown the subscriber
   */
  async shutdown(): Promise<void> {
    const metrics = this.getMetrics();
    
    this.unsubscribeAll();

    this.logger.info('Event subscriber shut down', {
      totalHandled: this.handledCount,
      totalErrors: this.errorCount,
      finalSubscriptions: metrics.totalSubscriptions,
    });
  }
}

/**
 * Filtered Event Subscriber
 * 
 * Subscriber that only handles events matching specific criteria
 */
export class FilteredEventSubscriber extends EventSubscriber {
  constructor(
    logger: LoggingService,
    metrics: MetricsService,
    private readonly eventFilter: (event: DomainEvent) => boolean,
    config: EventSubscriberConfig = {}
  ) {
    super(logger, metrics, config);
  }

  /**
   * Handle event only if it passes the filter
   */
  async handleEvent(event: DomainEvent): Promise<void> {
    if (!this.eventFilter(event)) {
      return;
    }

    await super.handleEvent(event);
  }
}

/**
 * Priority Event Subscriber
 * 
 * Subscriber that handles events based on priority
 */
export class PriorityEventSubscriber extends EventSubscriber {
  private priorityHandlers = new Map<string, Array<{
    subscription: EventSubscription;
    priority: number;
  }>>();

  /**
   * Subscribe with priority
   */
  subscribeWithPriority(
    eventType: string,
    handler: EventHandler,
    priority: number = 0
  ): EventSubscription {
    const subscription = this.subscribe(eventType, handler);

    if (!this.priorityHandlers.has(eventType)) {
      this.priorityHandlers.set(eventType, []);
    }

    this.priorityHandlers.get(eventType)!.push({
      subscription,
      priority,
    });

    // Sort by priority (higher first)
    this.priorityHandlers.get(eventType)!.sort((a, b) => b.priority - a.priority);

    return subscription;
  }

  /**
   * Handle event with priority ordering
   */
  async handleEvent(event: DomainEvent): Promise<void> {
    const eventType = event.getEventName();
    const priorityHandlers = this.priorityHandlers.get(eventType) || [];

    if (priorityHandlers.length === 0) {
      return await super.handleEvent(event);
    }

    // Execute handlers in priority order
    for (const { subscription } of priorityHandlers) {
      if (subscription.isActive) {
        await this.executeHandler(subscription, event);
      }
    }
  }

  private async executeHandler(subscription: EventSubscription, event: DomainEvent): Promise<void> {
    // This would call the parent's private executeHandler method
    // For now, we'll call the handler directly
    try {
      await subscription.handler(event);
    } catch (error) {
      // Handle error appropriately
      console.error('Priority handler failed:', error);
    }
  }
}