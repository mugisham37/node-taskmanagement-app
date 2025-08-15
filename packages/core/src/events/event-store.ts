import { DomainEvent, EventSnapshot, EventStreamInfo } from '../types/event.interface';

/**
 * Event store interface for persisting and retrieving domain events
 */
export interface EventStore {
  append(streamId: string, events: DomainEvent[]): Promise<void>;
  getEvents(streamId: string, fromVersion?: number): Promise<DomainEvent[]>;
  getAllEvents(fromPosition?: number): Promise<DomainEvent[]>;
  getStreamInfo(streamId: string): Promise<EventStreamInfo | null>;
  saveSnapshot<T>(snapshot: EventSnapshot<T>): Promise<void>;
  getSnapshot<T>(streamId: string): Promise<EventSnapshot<T> | null>;
}

/**
 * Simple in-memory event store implementation
 */
export class InMemoryEventStore implements EventStore {
  private events = new Map<string, DomainEvent[]>();
  private snapshots = new Map<string, EventSnapshot>();
  private globalEvents: DomainEvent[] = [];

  async append(streamId: string, events: DomainEvent[]): Promise<void> {
    if (!this.events.has(streamId)) {
      this.events.set(streamId, []);
    }

    const streamEvents = this.events.get(streamId)!;
    streamEvents.push(...events);
    this.globalEvents.push(...events);
  }

  async getEvents(streamId: string, fromVersion?: number): Promise<DomainEvent[]> {
    const streamEvents = this.events.get(streamId) || [];
    
    if (fromVersion === undefined) {
      return [...streamEvents];
    }

    return streamEvents.slice(fromVersion);
  }

  async getAllEvents(fromPosition?: number): Promise<DomainEvent[]> {
    if (fromPosition === undefined) {
      return [...this.globalEvents];
    }

    return this.globalEvents.slice(fromPosition);
  }

  async getStreamInfo(streamId: string): Promise<EventStreamInfo | null> {
    const streamEvents = this.events.get(streamId);
    
    if (!streamEvents || streamEvents.length === 0) {
      return null;
    }

    return {
      streamId,
      version: streamEvents.length,
      eventCount: streamEvents.length,
      firstEventTimestamp: streamEvents[0].occurredOn,
      lastEventTimestamp: streamEvents[streamEvents.length - 1].occurredOn,
    };
  }

  async saveSnapshot<T>(snapshot: EventSnapshot<T>): Promise<void> {
    this.snapshots.set(snapshot.streamId, snapshot);
  }

  async getSnapshot<T>(streamId: string): Promise<EventSnapshot<T> | null> {
    const snapshot = this.snapshots.get(streamId);
    return snapshot ? (snapshot as EventSnapshot<T>) : null;
  }

  /**
   * Get all stream IDs
   */
  getStreamIds(): string[] {
    return Array.from(this.events.keys());
  }

  /**
   * Get total event count across all streams
   */
  getTotalEventCount(): number {
    return this.globalEvents.length;
  }

  /**
   * Clear all events and snapshots
   */
  clear(): void {
    this.events.clear();
    this.snapshots.clear();
    this.globalEvents = [];
  }

  /**
   * Get events by type across all streams
   */
  async getEventsByType(eventType: string): Promise<DomainEvent[]> {
    return this.globalEvents.filter(event => event.constructor.name === eventType);
  }
}