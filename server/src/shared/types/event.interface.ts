/**
 * Event interfaces for domain and integration events
 */

export interface DomainEvent {
  readonly eventId: string;
  readonly occurredOn: Date;
  readonly eventVersion: number;
}

export interface IntegrationEvent extends DomainEvent {
  readonly correlationId: string;
  readonly causationId: string;
}

export interface EventMetadata {
  eventId: string;
  occurredOn: Date;
  eventVersion: number;
  correlationId?: string;
  causationId?: string;
  userId?: string;
  sessionId?: string;
}

export interface EventHandler<T extends DomainEvent = DomainEvent> {
  handle(event: T): Promise<void>;
}

export interface EventBus {
  publish<T extends DomainEvent>(event: T): Promise<void>;
  publishMany<T extends DomainEvent>(events: T[]): Promise<void>;
  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: EventHandler<T>
  ): void;
  unsubscribe(eventType: string, handler: EventHandler): void;
}

export interface EventStore {
  append(streamId: string, events: DomainEvent[]): Promise<void>;
  getEvents(streamId: string, fromVersion?: number): Promise<DomainEvent[]>;
  getAllEvents(fromPosition?: number): Promise<DomainEvent[]>;
}

export interface EventProjection {
  project(event: DomainEvent): Promise<void>;
  reset(): Promise<void>;
}

export interface EventSnapshot<T = any> {
  streamId: string;
  version: number;
  data: T;
  timestamp: Date;
}

export interface EventSubscription {
  id: string;
  eventType: string;
  handler: EventHandler;
  isActive: boolean;
  createdAt: Date;
}

export interface EventProcessingResult {
  eventId: string;
  success: boolean;
  error?: string;
  processedAt: Date;
  processingTime: number;
}

export interface EventReplay {
  fromPosition: number;
  toPosition?: number;
  eventTypes?: string[];
  streamIds?: string[];
}

export interface EventStreamInfo {
  streamId: string;
  version: number;
  eventCount: number;
  firstEventTimestamp: Date;
  lastEventTimestamp: Date;
}
