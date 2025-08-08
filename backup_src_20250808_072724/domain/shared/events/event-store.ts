import { DomainEvent } from './domain-event';
import { logger } from '@/infrastructure/logging/logger';

export interface EventStore {
  append(event: DomainEvent): Promise<void>;
  appendMany(events: DomainEvent[]): Promise<void>;
  getEvents(aggregateId: string, fromVersion?: number): Promise<StoredEvent[]>;
  getEventsByType(
    eventType: string,
    limit?: number,
    offset?: number
  ): Promise<StoredEvent[]>;
  getAllEvents(limit?: number, offset?: number): Promise<StoredEvent[]>;
  getEventStream(fromTimestamp?: Date): AsyncIterable<StoredEvent>;
  createSnapshot(
    aggregateId: string,
    version: number,
    data: any
  ): Promise<void>;
  getSnapshot(aggregateId: string): Promise<EventSnapshot | null>;
}

export interface StoredEvent {
  id: string;
  eventId: string;
  eventName: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  data: Record<string, any>;
  metadata: EventMetadata;
  occurredAt: Date;
  storedAt: Date;
}

export interface EventSnapshot {
  aggregateId: string;
  aggregateType: string;
  version: number;
  data: any;
  createdAt: Date;
}

export interface EventMetadata {
  correlationId?: string;
  causationId?: string;
  userId?: string;
  workspaceId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface EventStoreMetrics {
  totalEvents: number;
  totalSnapshots: number;
  averageAppendTime: number;
  storageSize: number;
}

export class InMemoryEventStore implements EventStore {
  private events: StoredEvent[] = [];
  private snapshots = new Map<string, EventSnapshot>();
  private eventIdIndex = new Map<string, StoredEvent>();
  private aggregateIndex = new Map<string, StoredEvent[]>();
  private typeIndex = new Map<string, StoredEvent[]>();
  private nextId = 1;
  private metrics: EventStoreMetrics = {
    totalEvents: 0,
    totalSnapshots: 0,
    averageAppendTime: 0,
    storageSize: 0,
  };
  private appendTimes: number[] = [];

  async append(event: DomainEvent): Promise<void> {
    const startTime = Date.now();

    try {
      const storedEvent: StoredEvent = {
        id: this.nextId.toString(),
        eventId: event.eventId,
        eventName: event.eventName,
        aggregateId: event.getAggregateId(),
        aggregateType: event.getAggregateType(),
        version: event.version,
        data: event.getEventData(),
        metadata: {
          correlationId: event.correlationId,
          causationId: event.causationId,
        },
        occurredAt: event.occurredAt,
        storedAt: new Date(),
      };

      // Store event
      this.events.push(storedEvent);
      this.nextId++;

      // Update indexes
      this.eventIdIndex.set(event.eventId, storedEvent);

      if (!this.aggregateIndex.has(storedEvent.aggregateId)) {
        this.aggregateIndex.set(storedEvent.aggregateId, []);
      }
      this.aggregateIndex.get(storedEvent.aggregateId)!.push(storedEvent);

      if (!this.typeIndex.has(storedEvent.eventName)) {
        this.typeIndex.set(storedEvent.eventName, []);
      }
      this.typeIndex.get(storedEvent.eventName)!.push(storedEvent);

      // Update metrics
      this.metrics.totalEvents++;
      const appendTime = Date.now() - startTime;
      this.appendTimes.push(appendTime);

      if (this.appendTimes.length > 100) {
        this.appendTimes.shift();
      }

      this.metrics.averageAppendTime =
        this.appendTimes.reduce((sum, time) => sum + time, 0) /
        this.appendTimes.length;

      this.metrics.storageSize = this.calculateStorageSize();

      logger.debug('Event appended to store', {
        eventId: event.eventId,
        eventName: event.eventName,
        aggregateId: event.getAggregateId(),
        appendTime,
      });
    } catch (error) {
      logger.error('Error appending event to store', {
        error: error instanceof Error ? error.message : String(error),
        eventId: event.eventId,
        eventName: event.eventName,
      });
      throw error;
    }
  }

  async appendMany(events: DomainEvent[]): Promise<void> {
    if (events.length === 0) return;

    logger.debug('Appending multiple events to store', {
      eventCount: events.length,
    });

    // Append events sequentially to maintain order
    for (const event of events) {
      await this.append(event);
    }
  }

  async getEvents(
    aggregateId: string,
    fromVersion?: number
  ): Promise<StoredEvent[]> {
    const aggregateEvents = this.aggregateIndex.get(aggregateId) || [];

    let filteredEvents = aggregateEvents;
    if (fromVersion !== undefined) {
      filteredEvents = aggregateEvents.filter(
        event => event.version >= fromVersion
      );
    }

    // Sort by version to ensure proper order
    filteredEvents.sort((a, b) => a.version - b.version);

    logger.debug('Retrieved events for aggregate', {
      aggregateId,
      fromVersion,
      eventCount: filteredEvents.length,
    });

    return filteredEvents;
  }

  async getEventsByType(
    eventType: string,
    limit?: number,
    offset?: number
  ): Promise<StoredEvent[]> {
    const typeEvents = this.typeIndex.get(eventType) || [];

    // Sort by stored date (newest first)
    const sortedEvents = [...typeEvents].sort(
      (a, b) => b.storedAt.getTime() - a.storedAt.getTime()
    );

    let result = sortedEvents;

    if (offset) {
      result = result.slice(offset);
    }

    if (limit) {
      result = result.slice(0, limit);
    }

    logger.debug('Retrieved events by type', {
      eventType,
      limit,
      offset,
      eventCount: result.length,
    });

    return result;
  }

  async getAllEvents(limit?: number, offset?: number): Promise<StoredEvent[]> {
    // Sort by stored date (newest first)
    const sortedEvents = [...this.events].sort(
      (a, b) => b.storedAt.getTime() - a.storedAt.getTime()
    );

    let result = sortedEvents;

    if (offset) {
      result = result.slice(offset);
    }

    if (limit) {
      result = result.slice(0, limit);
    }

    logger.debug('Retrieved all events', {
      limit,
      offset,
      eventCount: result.length,
      totalEvents: this.events.length,
    });

    return result;
  }

  async *getEventStream(fromTimestamp?: Date): AsyncIterable<StoredEvent> {
    let events = this.events;

    if (fromTimestamp) {
      events = events.filter(event => event.occurredAt >= fromTimestamp);
    }

    // Sort by occurred date
    events.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

    for (const event of events) {
      yield event;
    }
  }

  async createSnapshot(
    aggregateId: string,
    version: number,
    data: any
  ): Promise<void> {
    const snapshot: EventSnapshot = {
      aggregateId,
      aggregateType: this.getAggregateTypeFromEvents(aggregateId),
      version,
      data,
      createdAt: new Date(),
    };

    this.snapshots.set(aggregateId, snapshot);
    this.metrics.totalSnapshots++;

    logger.debug('Snapshot created', {
      aggregateId,
      version,
    });
  }

  async getSnapshot(aggregateId: string): Promise<EventSnapshot | null> {
    const snapshot = this.snapshots.get(aggregateId) || null;

    logger.debug('Retrieved snapshot', {
      aggregateId,
      found: !!snapshot,
      version: snapshot?.version,
    });

    return snapshot;
  }

  getMetrics(): EventStoreMetrics {
    return { ...this.metrics };
  }

  // Utility methods
  private getAggregateTypeFromEvents(aggregateId: string): string {
    const events = this.aggregateIndex.get(aggregateId) || [];
    return events.length > 0 ? events[0].aggregateType : 'Unknown';
  }

  private calculateStorageSize(): number {
    // Rough estimation of storage size in bytes
    return JSON.stringify({
      events: this.events,
      snapshots: Array.from(this.snapshots.values()),
    }).length;
  }

  // Admin methods
  clear(): void {
    this.events = [];
    this.snapshots.clear();
    this.eventIdIndex.clear();
    this.aggregateIndex.clear();
    this.typeIndex.clear();
    this.nextId = 1;
    this.metrics = {
      totalEvents: 0,
      totalSnapshots: 0,
      averageAppendTime: 0,
      storageSize: 0,
    };
    this.appendTimes = [];

    logger.info('Event store cleared');
  }

  getEventById(eventId: string): StoredEvent | null {
    return this.eventIdIndex.get(eventId) || null;
  }

  getAggregateIds(): string[] {
    return Array.from(this.aggregateIndex.keys());
  }

  getEventTypes(): string[] {
    return Array.from(this.typeIndex.keys());
  }
}
