import { LoggingService, MetricsService } from '@taskmanagement/core';
import { DomainEvent } from '@taskmanagement/domain';
import { IEventBus } from '../bus/event-bus';
import { IEventStore } from '../storage/event-store';

/**
 * Event Replay Configuration
 */
export interface EventReplayConfig {
  batchSize?: number;
  delayBetweenBatches?: number;
  enableMetrics?: boolean;
  enableErrorRecovery?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Replay Progress Information
 */
export interface ReplayProgress {
  totalEvents: number;
  processedEvents: number;
  failedEvents: number;
  currentPosition: number;
  startTime: Date;
  estimatedCompletion?: Date;
  isComplete: boolean;
  errors: ReplayError[];
}

/**
 * Replay Error Information
 */
export interface ReplayError {
  eventId: string;
  eventType: string;
  position: number;
  error: string;
  timestamp: Date;
  retryCount: number;
}

/**
 * Replay Filter Function
 */
export type ReplayFilter = (event: DomainEvent) => boolean;

/**
 * Event Replay Service
 * 
 * Provides functionality to replay events from the event store
 * with support for filtering, batching, and error recovery.
 */
export class EventReplayService {
  private isReplaying = false;
  private currentReplay?: ReplayProgress;
  private replayId = 0;

  constructor(
    private readonly eventStore: IEventStore,
    private readonly eventBus: IEventBus,
    private readonly logger: LoggingService,
    private readonly metrics: MetricsService,
    private readonly config: EventReplayConfig = {}
  ) {
    this.config = {
      batchSize: 100,
      delayBetweenBatches: 100,
      enableMetrics: true,
      enableErrorRecovery: true,
      maxRetries: 3,
      retryDelay: 1000,
      ...config,
    };
  }

  /**
   * Replay all events from the event store
   */
  async replayAllEvents(
    fromPosition?: number,
    filter?: ReplayFilter
  ): Promise<ReplayProgress> {
    if (this.isReplaying) {
      throw new Error('Replay is already in progress');
    }

    const replayId = ++this.replayId;
    this.isReplaying = true;

    try {
      this.logger.info('Starting event replay', {
        replayId,
        fromPosition,
        hasFilter: !!filter,
      });

      // Get all events from the store
      const allEvents = await this.eventStore.getAllEvents(fromPosition);
      
      // Apply filter if provided
      const eventsToReplay = filter ? allEvents.filter(filter) : allEvents;

      // Initialize progress tracking
      this.currentReplay = {
        totalEvents: eventsToReplay.length,
        processedEvents: 0,
        failedEvents: 0,
        currentPosition: fromPosition || 0,
        startTime: new Date(),
        isComplete: false,
        errors: [],
      };

      // Replay events in batches
      await this.replayEventsBatched(eventsToReplay);

      // Mark as complete
      this.currentReplay.isComplete = true;
      this.currentReplay.estimatedCompletion = new Date();

      this.logger.info('Event replay completed', {
        replayId,
        totalEvents: this.currentReplay.totalEvents,
        processedEvents: this.currentReplay.processedEvents,
        failedEvents: this.currentReplay.failedEvents,
        duration: Date.now() - this.currentReplay.startTime.getTime(),
      });

      if (this.config.enableMetrics) {
        this.metrics.incrementCounter('event_replay_completed_total');
        this.metrics.recordHistogram(
          'event_replay_duration',
          Date.now() - this.currentReplay.startTime.getTime()
        );
      }

      return { ...this.currentReplay };
    } catch (error) {
      this.logger.error('Event replay failed', error as Error, {
        replayId,
        fromPosition,
      });

      if (this.config.enableMetrics) {
        this.metrics.incrementCounter('event_replay_failed_total');
      }

      throw error;
    } finally {
      this.isReplaying = false;
    }
  }

  /**
   * Replay events from a specific stream
   */
  async replayStream(
    streamId: string,
    fromVersion?: number,
    toVersion?: number,
    filter?: ReplayFilter
  ): Promise<ReplayProgress> {
    if (this.isReplaying) {
      throw new Error('Replay is already in progress');
    }

    const replayId = ++this.replayId;
    this.isReplaying = true;

    try {
      this.logger.info('Starting stream replay', {
        replayId,
        streamId,
        fromVersion,
        toVersion,
        hasFilter: !!filter,
      });

      // Get events from the stream
      const streamEvents = await this.eventStore.getEvents(streamId, fromVersion, toVersion);
      
      // Apply filter if provided
      const eventsToReplay = filter ? streamEvents.filter(filter) : streamEvents;

      // Initialize progress tracking
      this.currentReplay = {
        totalEvents: eventsToReplay.length,
        processedEvents: 0,
        failedEvents: 0,
        currentPosition: fromVersion || 0,
        startTime: new Date(),
        isComplete: false,
        errors: [],
      };

      // Replay events in batches
      await this.replayEventsBatched(eventsToReplay);

      // Mark as complete
      this.currentReplay.isComplete = true;
      this.currentReplay.estimatedCompletion = new Date();

      this.logger.info('Stream replay completed', {
        replayId,
        streamId,
        totalEvents: this.currentReplay.totalEvents,
        processedEvents: this.currentReplay.processedEvents,
        failedEvents: this.currentReplay.failedEvents,
        duration: Date.now() - this.currentReplay.startTime.getTime(),
      });

      return { ...this.currentReplay };
    } catch (error) {
      this.logger.error('Stream replay failed', error as Error, {
        replayId,
        streamId,
        fromVersion,
        toVersion,
      });
      throw error;
    } finally {
      this.isReplaying = false;
    }
  }

  /**
   * Replay events by type
   */
  async replayEventsByType(
    eventType: string,
    fromPosition?: number,
    maxCount?: number
  ): Promise<ReplayProgress> {
    if (this.isReplaying) {
      throw new Error('Replay is already in progress');
    }

    const replayId = ++this.replayId;
    this.isReplaying = true;

    try {
      this.logger.info('Starting event type replay', {
        replayId,
        eventType,
        fromPosition,
        maxCount,
      });

      // Get events by type
      const events = await this.eventStore.getEventsByType(eventType, fromPosition, maxCount);

      // Initialize progress tracking
      this.currentReplay = {
        totalEvents: events.length,
        processedEvents: 0,
        failedEvents: 0,
        currentPosition: fromPosition || 0,
        startTime: new Date(),
        isComplete: false,
        errors: [],
      };

      // Replay events in batches
      await this.replayEventsBatched(events);

      // Mark as complete
      this.currentReplay.isComplete = true;
      this.currentReplay.estimatedCompletion = new Date();

      this.logger.info('Event type replay completed', {
        replayId,
        eventType,
        totalEvents: this.currentReplay.totalEvents,
        processedEvents: this.currentReplay.processedEvents,
        failedEvents: this.currentReplay.failedEvents,
        duration: Date.now() - this.currentReplay.startTime.getTime(),
      });

      return { ...this.currentReplay };
    } catch (error) {
      this.logger.error('Event type replay failed', error as Error, {
        replayId,
        eventType,
        fromPosition,
        maxCount,
      });
      throw error;
    } finally {
      this.isReplaying = false;
    }
  }

  /**
   * Get current replay progress
   */
  getReplayProgress(): ReplayProgress | null {
    return this.currentReplay ? { ...this.currentReplay } : null;
  }

  /**
   * Check if replay is currently in progress
   */
  isReplayInProgress(): boolean {
    return this.isReplaying;
  }

  /**
   * Cancel current replay
   */
  async cancelReplay(): Promise<void> {
    if (!this.isReplaying) {
      return;
    }

    this.logger.info('Cancelling event replay');
    this.isReplaying = false;

    if (this.currentReplay) {
      this.currentReplay.isComplete = true;
      this.currentReplay.estimatedCompletion = new Date();
    }

    if (this.config.enableMetrics) {
      this.metrics.incrementCounter('event_replay_cancelled_total');
    }
  }

  /**
   * Replay events in batches
   */
  private async replayEventsBatched(events: DomainEvent[]): Promise<void> {
    const batchSize = this.config.batchSize || 100;
    const delayBetweenBatches = this.config.delayBetweenBatches || 100;

    for (let i = 0; i < events.length; i += batchSize) {
      if (!this.isReplaying) {
        // Replay was cancelled
        break;
      }

      const batch = events.slice(i, Math.min(i + batchSize, events.length));
      
      this.logger.debug('Processing replay batch', {
        batchStart: i,
        batchSize: batch.length,
        totalEvents: events.length,
      });

      // Process batch
      await this.processBatch(batch);

      // Update progress
      if (this.currentReplay) {
        this.currentReplay.processedEvents = Math.min(i + batchSize, events.length);
        this.updateEstimatedCompletion();
      }

      // Delay between batches to avoid overwhelming the system
      if (i + batchSize < events.length && delayBetweenBatches > 0) {
        await this.delay(delayBetweenBatches);
      }
    }
  }

  /**
   * Process a batch of events
   */
  private async processBatch(events: DomainEvent[]): Promise<void> {
    const promises = events.map(event => this.replayEvent(event));
    await Promise.allSettled(promises);
  }

  /**
   * Replay a single event
   */
  private async replayEvent(event: DomainEvent): Promise<void> {
    let retryCount = 0;
    const maxRetries = this.config.maxRetries || 3;

    while (retryCount <= maxRetries) {
      try {
        // Publish the event through the event bus
        await this.eventBus.publish(event);

        this.logger.debug('Event replayed successfully', {
          eventId: event.getEventId(),
          eventType: event.getEventName(),
          retryCount,
        });

        if (this.config.enableMetrics) {
          this.metrics.incrementCounter('events_replayed_success_total', {
            eventType: event.getEventName(),
          });
        }

        return; // Success
      } catch (error) {
        retryCount++;

        this.logger.warn('Event replay failed', {
          eventId: event.getEventId(),
          eventType: event.getEventName(),
          retryCount,
          maxRetries,
          error: (error as Error).message,
        });

        if (retryCount <= maxRetries && this.config.enableErrorRecovery) {
          // Wait before retry
          await this.delay(this.config.retryDelay || 1000);
        } else {
          // Max retries exceeded or error recovery disabled
          const replayError: ReplayError = {
            eventId: event.getEventId(),
            eventType: event.getEventName(),
            position: 0, // Would need to track position properly
            error: (error as Error).message,
            timestamp: new Date(),
            retryCount: retryCount - 1,
          };

          if (this.currentReplay) {
            this.currentReplay.failedEvents++;
            this.currentReplay.errors.push(replayError);
          }

          if (this.config.enableMetrics) {
            this.metrics.incrementCounter('events_replayed_failed_total', {
              eventType: event.getEventName(),
            });
          }

          this.logger.error('Event replay failed after all retries', error as Error, {
            eventId: event.getEventId(),
            eventType: event.getEventName(),
            totalRetries: retryCount - 1,
          });

          return; // Don't throw to continue with other events
        }
      }
    }
  }

  /**
   * Update estimated completion time
   */
  private updateEstimatedCompletion(): void {
    if (!this.currentReplay) {
      return;
    }

    const { totalEvents, processedEvents, startTime } = this.currentReplay;
    
    if (processedEvents === 0) {
      return;
    }

    const elapsedTime = Date.now() - startTime.getTime();
    const averageTimePerEvent = elapsedTime / processedEvents;
    const remainingEvents = totalEvents - processedEvents;
    const estimatedRemainingTime = remainingEvents * averageTimePerEvent;

    this.currentReplay.estimatedCompletion = new Date(Date.now() + estimatedRemainingTime);
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create common event filters
   */
  static createFilters() {
    return {
      /**
       * Filter events by type
       */
      byEventType: (eventType: string): ReplayFilter => {
        return (event: DomainEvent) => event.getEventName() === eventType;
      },

      /**
       * Filter events by aggregate ID
       */
      byAggregateId: (aggregateId: string): ReplayFilter => {
        return (event: DomainEvent) => event.getAggregateId() === aggregateId;
      },

      /**
       * Filter events by date range
       */
      byDateRange: (startDate: Date, endDate: Date): ReplayFilter => {
        return (event: DomainEvent) => {
          const eventDate = event.getOccurredOn();
          return eventDate >= startDate && eventDate <= endDate;
        };
      },

      /**
       * Filter events after a specific date
       */
      afterDate: (date: Date): ReplayFilter => {
        return (event: DomainEvent) => event.getOccurredOn() > date;
      },

      /**
       * Filter events before a specific date
       */
      beforeDate: (date: Date): ReplayFilter => {
        return (event: DomainEvent) => event.getOccurredOn() < date;
      },

      /**
       * Combine multiple filters with AND logic
       */
      and: (...filters: ReplayFilter[]): ReplayFilter => {
        return (event: DomainEvent) => filters.every(filter => filter(event));
      },

      /**
       * Combine multiple filters with OR logic
       */
      or: (...filters: ReplayFilter[]): ReplayFilter => {
        return (event: DomainEvent) => filters.some(filter => filter(event));
      },

      /**
       * Negate a filter
       */
      not: (filter: ReplayFilter): ReplayFilter => {
        return (event: DomainEvent) => !filter(event);
      },
    };
  }
}