import { LoggingService, MetricsService } from '@taskmanagement/core';
import { DomainEvent } from '@taskmanagement/domain';
import { IEventSerializer, SerializedEvent } from '../serializers/event-serializer';

/**
 * Event Store Interface
 */
export interface IEventStore {
  append(streamId: string, events: DomainEvent[], expectedVersion?: number): Promise<void>;
  getEvents(streamId: string, fromVersion?: number, toVersion?: number): Promise<DomainEvent[]>;
  getAllEvents(fromPosition?: number, maxCount?: number): Promise<DomainEvent[]>;
  getEventsByType(eventType: string, fromPosition?: number, maxCount?: number): Promise<DomainEvent[]>;
  getStreamMetadata(streamId: string): Promise<StreamMetadata>;
  deleteStream(streamId: string): Promise<void>;
  createSnapshot(streamId: string, version: number, snapshot: any): Promise<void>;
  getSnapshot(streamId: string): Promise<Snapshot | null>;
}

/**
 * Stream Metadata
 */
export interface StreamMetadata {
  streamId: string;
  version: number;
  eventCount: number;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
}

/**
 * Snapshot
 */
export interface Snapshot {
  streamId: string;
  version: number;
  data: any;
  createdAt: Date;
}

/**
 * Event Store Entry
 */
export interface EventStoreEntry {
  id: string;
  streamId: string;
  version: number;
  eventType: string;
  eventData: string;
  metadata?: string;
  createdAt: Date;
  position: number;
}

/**
 * Event Store Configuration
 */
export interface EventStoreConfig {
  enableSnapshots?: boolean;
  snapshotFrequency?: number;
  maxEventsPerRead?: number;
  enableMetrics?: boolean;
  enableCaching?: boolean;
}

/**
 * In-Memory Event Store
 * 
 * Simple in-memory implementation for testing and development
 */
export class InMemoryEventStore implements IEventStore {
  private events = new Map<string, EventStoreEntry[]>();
  private snapshots = new Map<string, Snapshot>();
  private globalPosition = 0;
  private streamVersions = new Map<string, number>();

  constructor(
    private readonly logger: LoggingService,
    private readonly metrics: MetricsService,
    private readonly serializer: IEventSerializer,
    private readonly config: EventStoreConfig = {}
  ) {
    this.config = {
      enableSnapshots: true,
      snapshotFrequency: 10,
      maxEventsPerRead: 1000,
      enableMetrics: true,
      enableCaching: false,
      ...config,
    };
  }

  /**
   * Append events to a stream
   */
  async append(streamId: string, events: DomainEvent[], expectedVersion?: number): Promise<void> {
    const startTime = Date.now();

    try {
      // Check expected version
      const currentVersion = this.streamVersions.get(streamId) || 0;
      if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
        throw new Error(`Concurrency conflict. Expected version ${expectedVersion}, but current version is ${currentVersion}`);
      }

      // Get or create stream
      if (!this.events.has(streamId)) {
        this.events.set(streamId, []);
      }

      const streamEvents = this.events.get(streamId)!;
      let version = currentVersion;

      // Append events
      for (const event of events) {
        version++;
        const serializedEvent = this.serializer.serialize(event);
        
        const entry: EventStoreEntry = {
          id: event.getEventId(),
          streamId,
          version,
          eventType: event.getEventName(),
          eventData: serializedEvent.data,
          metadata: serializedEvent.metadata ? JSON.stringify(serializedEvent.metadata) : undefined,
          createdAt: new Date(),
          position: ++this.globalPosition,
        };

        streamEvents.push(entry);
      }

      // Update stream version
      this.streamVersions.set(streamId, version);

      const duration = Date.now() - startTime;

      this.logger.info('Events appended to stream', {
        streamId,
        eventCount: events.length,
        newVersion: version,
        duration,
      });

      if (this.config.enableMetrics) {
        this.metrics.incrementCounter('events_appended_total', {
          streamId,
          count: events.length.toString(),
        });
        this.metrics.recordHistogram('event_append_duration', duration);
      }

      // Create snapshot if needed
      if (this.config.enableSnapshots && version % (this.config.snapshotFrequency || 10) === 0) {
        await this.createAutoSnapshot(streamId, version);
      }
    } catch (error) {
      this.logger.error('Failed to append events to stream', error as Error, {
        streamId,
        eventCount: events.length,
        expectedVersion,
      });

      if (this.config.enableMetrics) {
        this.metrics.incrementCounter('event_append_errors_total');
      }

      throw error;
    }
  }

  /**
   * Get events from a stream
   */
  async getEvents(streamId: string, fromVersion?: number, toVersion?: number): Promise<DomainEvent[]> {
    const startTime = Date.now();

    try {
      const streamEvents = this.events.get(streamId) || [];
      
      let filteredEvents = streamEvents;

      // Filter by version range
      if (fromVersion !== undefined) {
        filteredEvents = filteredEvents.filter(e => e.version >= fromVersion);
      }
      if (toVersion !== undefined) {
        filteredEvents = filteredEvents.filter(e => e.version <= toVersion);
      }

      // Limit results
      const maxEvents = this.config.maxEventsPerRead || 1000;
      if (filteredEvents.length > maxEvents) {
        filteredEvents = filteredEvents.slice(0, maxEvents);
      }

      // Deserialize events
      const domainEvents = filteredEvents.map(entry => this.deserializeEvent(entry));

      const duration = Date.now() - startTime;

      this.logger.debug('Events retrieved from stream', {
        streamId,
        eventCount: domainEvents.length,
        fromVersion,
        toVersion,
        duration,
      });

      if (this.config.enableMetrics) {
        this.metrics.incrementCounter('events_read_total', {
          streamId,
          count: domainEvents.length.toString(),
        });
        this.metrics.recordHistogram('event_read_duration', duration);
      }

      return domainEvents;
    } catch (error) {
      this.logger.error('Failed to get events from stream', error as Error, {
        streamId,
        fromVersion,
        toVersion,
      });

      if (this.config.enableMetrics) {
        this.metrics.incrementCounter('event_read_errors_total');
      }

      throw error;
    }
  }

  /**
   * Get all events across all streams
   */
  async getAllEvents(fromPosition?: number, maxCount?: number): Promise<DomainEvent[]> {
    const startTime = Date.now();

    try {
      // Collect all events from all streams
      const allEvents: EventStoreEntry[] = [];
      for (const streamEvents of this.events.values()) {
        allEvents.push(...streamEvents);
      }

      // Sort by position
      allEvents.sort((a, b) => a.position - b.position);

      // Filter by position
      let filteredEvents = allEvents;
      if (fromPosition !== undefined) {
        filteredEvents = filteredEvents.filter(e => e.position >= fromPosition);
      }

      // Limit results
      const limit = Math.min(maxCount || 1000, this.config.maxEventsPerRead || 1000);
      if (filteredEvents.length > limit) {
        filteredEvents = filteredEvents.slice(0, limit);
      }

      // Deserialize events
      const domainEvents = filteredEvents.map(entry => this.deserializeEvent(entry));

      const duration = Date.now() - startTime;

      this.logger.debug('All events retrieved', {
        eventCount: domainEvents.length,
        fromPosition,
        maxCount,
        duration,
      });

      if (this.config.enableMetrics) {
        this.metrics.recordHistogram('event_read_all_duration', duration);
      }

      return domainEvents;
    } catch (error) {
      this.logger.error('Failed to get all events', error as Error, {
        fromPosition,
        maxCount,
      });
      throw error;
    }
  }

  /**
   * Get events by type
   */
  async getEventsByType(eventType: string, fromPosition?: number, maxCount?: number): Promise<DomainEvent[]> {
    const startTime = Date.now();

    try {
      // Collect all events of the specified type
      const matchingEvents: EventStoreEntry[] = [];
      for (const streamEvents of this.events.values()) {
        const typeEvents = streamEvents.filter(e => e.eventType === eventType);
        matchingEvents.push(...typeEvents);
      }

      // Sort by position
      matchingEvents.sort((a, b) => a.position - b.position);

      // Filter by position
      let filteredEvents = matchingEvents;
      if (fromPosition !== undefined) {
        filteredEvents = filteredEvents.filter(e => e.position >= fromPosition);
      }

      // Limit results
      const limit = Math.min(maxCount || 1000, this.config.maxEventsPerRead || 1000);
      if (filteredEvents.length > limit) {
        filteredEvents = filteredEvents.slice(0, limit);
      }

      // Deserialize events
      const domainEvents = filteredEvents.map(entry => this.deserializeEvent(entry));

      const duration = Date.now() - startTime;

      this.logger.debug('Events retrieved by type', {
        eventType,
        eventCount: domainEvents.length,
        fromPosition,
        maxCount,
        duration,
      });

      return domainEvents;
    } catch (error) {
      this.logger.error('Failed to get events by type', error as Error, {
        eventType,
        fromPosition,
        maxCount,
      });
      throw error;
    }
  }

  /**
   * Get stream metadata
   */
  async getStreamMetadata(streamId: string): Promise<StreamMetadata> {
    const streamEvents = this.events.get(streamId) || [];
    const version = this.streamVersions.get(streamId) || 0;

    const createdAt = streamEvents.length > 0 ? streamEvents[0].createdAt : new Date();
    const updatedAt = streamEvents.length > 0 ? streamEvents[streamEvents.length - 1].createdAt : new Date();

    return {
      streamId,
      version,
      eventCount: streamEvents.length,
      createdAt,
      updatedAt,
      isDeleted: false,
    };
  }

  /**
   * Delete a stream
   */
  async deleteStream(streamId: string): Promise<void> {
    this.events.delete(streamId);
    this.streamVersions.delete(streamId);
    this.snapshots.delete(streamId);

    this.logger.info('Stream deleted', { streamId });

    if (this.config.enableMetrics) {
      this.metrics.incrementCounter('streams_deleted_total');
    }
  }

  /**
   * Create a snapshot
   */
  async createSnapshot(streamId: string, version: number, snapshot: any): Promise<void> {
    const snapshotEntry: Snapshot = {
      streamId,
      version,
      data: snapshot,
      createdAt: new Date(),
    };

    this.snapshots.set(streamId, snapshotEntry);

    this.logger.debug('Snapshot created', {
      streamId,
      version,
    });

    if (this.config.enableMetrics) {
      this.metrics.incrementCounter('snapshots_created_total');
    }
  }

  /**
   * Get a snapshot
   */
  async getSnapshot(streamId: string): Promise<Snapshot | null> {
    return this.snapshots.get(streamId) || null;
  }

  /**
   * Deserialize event entry to domain event
   */
  private deserializeEvent(entry: EventStoreEntry): DomainEvent {
    const serializedEvent: SerializedEvent = {
      id: entry.id,
      eventType: entry.eventType,
      aggregateId: entry.streamId,
      aggregateType: 'Unknown',
      version: entry.version,
      occurredAt: entry.createdAt.toISOString(),
      data: entry.eventData,
      metadata: entry.metadata ? JSON.parse(entry.metadata) : undefined,
    };

    return this.serializer.deserialize(serializedEvent);
  }

  /**
   * Create automatic snapshot
   */
  private async createAutoSnapshot(streamId: string, version: number): Promise<void> {
    try {
      // Get all events for the stream
      const events = await this.getEvents(streamId);
      
      // Create a simple snapshot (in a real implementation, this would be more sophisticated)
      const snapshot = {
        streamId,
        version,
        eventCount: events.length,
        lastEventType: events.length > 0 ? events[events.length - 1].getEventName() : null,
        createdAt: new Date(),
      };

      await this.createSnapshot(streamId, version, snapshot);

      this.logger.debug('Auto snapshot created', {
        streamId,
        version,
      });
    } catch (error) {
      this.logger.error('Failed to create auto snapshot', error as Error, {
        streamId,
        version,
      });
      // Don't throw - snapshot creation failure shouldn't fail the append operation
    }
  }

  /**
   * Get store statistics
   */
  getStatistics(): {
    totalStreams: number;
    totalEvents: number;
    totalSnapshots: number;
    globalPosition: number;
  } {
    let totalEvents = 0;
    for (const streamEvents of this.events.values()) {
      totalEvents += streamEvents.length;
    }

    return {
      totalStreams: this.events.size,
      totalEvents,
      totalSnapshots: this.snapshots.size,
      globalPosition: this.globalPosition,
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.events.clear();
    this.snapshots.clear();
    this.streamVersions.clear();
    this.globalPosition = 0;

    this.logger.info('Event store cleared');
  }
}