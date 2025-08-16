import { LoggingService, MetricsService } from '@taskmanagement/core';
import { DomainEvent } from '@taskmanagement/domain';

/**
 * Event Publisher Interface
 */
export interface IEventPublisher {
  publish(event: DomainEvent): Promise<void>;
  publishBatch(events: DomainEvent[]): Promise<void>;
  publishAsync(event: DomainEvent): Promise<void>;
  getMetrics(): PublisherMetrics;
}

/**
 * Publisher Metrics Interface
 */
export interface PublisherMetrics {
  totalPublished: number;
  totalErrors: number;
  averageLatency: number;
  lastPublishedAt?: Date;
}

/**
 * Event Publisher Configuration
 */
export interface EventPublisherConfig {
  enableBatching?: boolean;
  batchSize?: number;
  batchTimeout?: number;
  enableRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  enableMetrics?: boolean;
}

/**
 * Base Event Publisher
 * 
 * Provides core event publishing functionality with batching,
 * retry mechanisms, and performance monitoring.
 */
export class EventPublisher implements IEventPublisher {
  private publishedCount = 0;
  private errorCount = 0;
  private latencySum = 0;
  private lastPublishedAt?: Date;
  private batchQueue: DomainEvent[] = [];
  private batchTimer?: NodeJS.Timeout;

  constructor(
    private readonly logger: LoggingService,
    private readonly metrics: MetricsService,
    private readonly config: EventPublisherConfig = {}
  ) {
    this.config = {
      enableBatching: false,
      batchSize: 10,
      batchTimeout: 1000,
      enableRetry: true,
      maxRetries: 3,
      retryDelay: 1000,
      enableMetrics: true,
      ...config,
    };
  }

  /**
   * Publish a single event
   */
  async publish(event: DomainEvent): Promise<void> {
    const startTime = Date.now();

    try {
      if (this.config.enableBatching) {
        await this.addToBatch(event);
      } else {
        await this.publishSingle(event);
      }

      this.recordSuccess(startTime);
    } catch (error) {
      this.recordError(error as Error);
      throw error;
    }
  }

  /**
   * Publish multiple events in a batch
   */
  async publishBatch(events: DomainEvent[]): Promise<void> {
    const startTime = Date.now();

    try {
      await this.publishMultiple(events);
      this.recordSuccess(startTime, events.length);
    } catch (error) {
      this.recordError(error as Error);
      throw error;
    }
  }

  /**
   * Publish event asynchronously (fire and forget)
   */
  async publishAsync(event: DomainEvent): Promise<void> {
    // Don't await the publish operation
    this.publish(event).catch((error) => {
      this.logger.error('Async event publishing failed', error, {
        eventId: event.getEventId(),
        eventType: event.getEventName(),
      });
    });
  }

  /**
   * Get publisher metrics
   */
  getMetrics(): PublisherMetrics {
    return {
      totalPublished: this.publishedCount,
      totalErrors: this.errorCount,
      averageLatency: this.publishedCount > 0 ? this.latencySum / this.publishedCount : 0,
      lastPublishedAt: this.lastPublishedAt,
    };
  }

  /**
   * Add event to batch queue
   */
  private async addToBatch(event: DomainEvent): Promise<void> {
    this.batchQueue.push(event);

    // Start batch timer if not already running
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flushBatch();
      }, this.config.batchTimeout);
    }

    // Flush batch if it reaches the configured size
    if (this.batchQueue.length >= (this.config.batchSize || 10)) {
      await this.flushBatch();
    }
  }

  /**
   * Flush the current batch
   */
  private async flushBatch(): Promise<void> {
    if (this.batchQueue.length === 0) {
      return;
    }

    const eventsToPublish = [...this.batchQueue];
    this.batchQueue = [];

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }

    try {
      await this.publishMultiple(eventsToPublish);
    } catch (error) {
      this.logger.error('Batch publishing failed', error as Error, {
        batchSize: eventsToPublish.length,
      });
      throw error;
    }
  }

  /**
   * Publish a single event with retry logic
   */
  private async publishSingle(event: DomainEvent): Promise<void> {
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= (this.config.maxRetries || 0)) {
      try {
        await this.doPublish(event);
        return; // Success
      } catch (error) {
        lastError = error as Error;
        attempt++;

        if (this.config.enableRetry && attempt <= (this.config.maxRetries || 0)) {
          this.logger.warn('Event publishing failed, retrying', {
            eventId: event.getEventId(),
            eventType: event.getEventName(),
            attempt,
            maxRetries: this.config.maxRetries,
          });

          await this.delay(this.config.retryDelay || 1000);
        }
      }
    }

    // All retries failed
    throw lastError;
  }

  /**
   * Publish multiple events
   */
  private async publishMultiple(events: DomainEvent[]): Promise<void> {
    const promises = events.map(event => this.publishSingle(event));
    await Promise.allSettled(promises);
  }

  /**
   * Core publish implementation (to be overridden by subclasses)
   */
  protected async doPublish(event: DomainEvent): Promise<void> {
    // Default implementation - log the event
    this.logger.info('Event published', {
      eventId: event.getEventId(),
      eventType: event.getEventName(),
      aggregateId: event.getAggregateId(),
      occurredAt: event.getOccurredOn(),
    });

    if (this.config.enableMetrics) {
      this.metrics.incrementCounter('events_published_total', {
        eventType: event.getEventName(),
      });
    }
  }

  /**
   * Record successful publish
   */
  private recordSuccess(startTime: number, count: number = 1): void {
    const latency = Date.now() - startTime;
    this.publishedCount += count;
    this.latencySum += latency;
    this.lastPublishedAt = new Date();

    if (this.config.enableMetrics) {
      this.metrics.recordHistogram('event_publish_duration', latency);
      this.metrics.incrementCounter('event_publish_success', { count: count.toString() });
    }
  }

  /**
   * Record publish error
   */
  private recordError(error: Error): void {
    this.errorCount++;

    if (this.config.enableMetrics) {
      this.metrics.incrementCounter('event_publish_errors');
    }

    this.logger.error('Event publishing error', error);
  }

  /**
   * Delay utility for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Shutdown the publisher
   */
  async shutdown(): Promise<void> {
    // Flush any remaining batched events
    if (this.batchQueue.length > 0) {
      await this.flushBatch();
    }

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }

    this.logger.info('Event publisher shut down', {
      totalPublished: this.publishedCount,
      totalErrors: this.errorCount,
    });
  }
}

/**
 * In-Memory Event Publisher
 * 
 * Simple publisher that keeps events in memory for testing
 */
export class InMemoryEventPublisher extends EventPublisher {
  private publishedEvents: DomainEvent[] = [];

  protected async doPublish(event: DomainEvent): Promise<void> {
    await super.doPublish(event);
    this.publishedEvents.push(event);
  }

  /**
   * Get all published events
   */
  getPublishedEvents(): DomainEvent[] {
    return [...this.publishedEvents];
  }

  /**
   * Clear published events
   */
  clearPublishedEvents(): void {
    this.publishedEvents = [];
  }

  /**
   * Get events by type
   */
  getEventsByType(eventType: string): DomainEvent[] {
    return this.publishedEvents.filter(event => event.getEventName() === eventType);
  }
}