/**
 * Base interface for all domain events
 */
export interface DomainEvent {
  /**
   * Unique identifier for the event
   */
  readonly eventId: string;

  /**
   * Type of the event
   */
  readonly eventType: string;

  /**
   * Version of the event schema
   */
  readonly eventVersion: number;

  /**
   * Timestamp when the event occurred
   */
  readonly occurredAt: Date;

  /**
   * ID of the aggregate that generated the event
   */
  readonly aggregateId: string;

  /**
   * Type of the aggregate that generated the event
   */
  readonly aggregateType: string;

  /**
   * Version of the aggregate when the event was generated
   */
  readonly aggregateVersion: number;

  /**
   * User ID who triggered the event (if applicable)
   */
  readonly userId?: string;

  /**
   * Workspace context (if applicable)
   */
  readonly workspaceId?: string;

  /**
   * Correlation ID for tracing related events
   */
  readonly correlationId?: string;

  /**
   * Causation ID for event causality tracking
   */
  readonly causationId?: string;

  /**
   * Event-specific data
   */
  readonly data: Record<string, any>;

  /**
   * Metadata for the event
   */
  readonly metadata: Record<string, any>;
}

/**
 * Base class for domain events
 */
export abstract class BaseDomainEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventType: string;
  public readonly eventVersion: number;
  public readonly occurredAt: Date;
  public readonly aggregateId: string;
  public readonly aggregateType: string;
  public readonly aggregateVersion: number;
  public readonly userId?: string;
  public readonly workspaceId?: string;
  public readonly correlationId?: string;
  public readonly causationId?: string;
  public readonly data: Record<string, any>;
  public readonly metadata: Record<string, any>;

  constructor(props: {
    eventType: string;
    eventVersion?: number;
    aggregateId: string;
    aggregateType: string;
    aggregateVersion: number;
    userId?: string;
    workspaceId?: string;
    correlationId?: string;
    causationId?: string;
    data: Record<string, any>;
    metadata?: Record<string, any>;
  }) {
    this.eventId = this.generateEventId();
    this.eventType = props.eventType;
    this.eventVersion = props.eventVersion || 1;
    this.occurredAt = new Date();
    this.aggregateId = props.aggregateId;
    this.aggregateType = props.aggregateType;
    this.aggregateVersion = props.aggregateVersion;
    this.userId = props.userId;
    this.workspaceId = props.workspaceId;
    this.correlationId = props.correlationId;
    this.causationId = props.causationId;
    this.data = Object.freeze({ ...props.data });
    this.metadata = Object.freeze({
      ...props.metadata,
      timestamp: this.occurredAt.toISOString(),
      source: 'unified-enterprise-platform',
    });
  }

  private generateEventId(): string {
    // Generate a unique event ID (using timestamp + random)
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `evt_${timestamp}_${random}`;
  }

  /**
   * Convert event to plain object for serialization
   */
  public toPlainObject(): Record<string, any> {
    return {
      eventId: this.eventId,
      eventType: this.eventType,
      eventVersion: this.eventVersion,
      occurredAt: this.occurredAt.toISOString(),
      aggregateId: this.aggregateId,
      aggregateType: this.aggregateType,
      aggregateVersion: this.aggregateVersion,
      userId: this.userId,
      workspaceId: this.workspaceId,
      correlationId: this.correlationId,
      causationId: this.causationId,
      data: this.data,
      metadata: this.metadata,
    };
  }

  /**
   * Create event from plain object
   */
  public static fromPlainObject(obj: Record<string, any>): DomainEvent {
    return {
      eventId: obj.eventId,
      eventType: obj.eventType,
      eventVersion: obj.eventVersion,
      occurredAt: new Date(obj.occurredAt),
      aggregateId: obj.aggregateId,
      aggregateType: obj.aggregateType,
      aggregateVersion: obj.aggregateVersion,
      userId: obj.userId,
      workspaceId: obj.workspaceId,
      correlationId: obj.correlationId,
      causationId: obj.causationId,
      data: obj.data,
      metadata: obj.metadata,
    };
  }
}

/**
 * Event handler interface
 */
export interface DomainEventHandler<T extends DomainEvent = DomainEvent> {
  /**
   * Handle the domain event
   */
  handle(event: T): Promise<void>;

  /**
   * Get the event types this handler can process
   */
  getHandledEventTypes(): string[];

  /**
   * Get handler priority (lower number = higher priority)
   */
  getPriority?(): number;
}

/**
 * Event bus interface
 */
export interface DomainEventBus {
  /**
   * Publish a single event
   */
  publish(event: DomainEvent): Promise<void>;

  /**
   * Publish multiple events
   */
  publishAll(events: DomainEvent[]): Promise<void>;

  /**
   * Subscribe to events
   */
  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: DomainEventHandler<T>
  ): Promise<void>;

  /**
   * Unsubscribe from events
   */
  unsubscribe(eventType: string, handler: DomainEventHandler): Promise<void>;

  /**
   * Clear all subscriptions
   */
  clear(): Promise<void>;
}

/**
 * Event store interface for event sourcing
 */
export interface DomainEventStore {
  /**
   * Save events to the store
   */
  saveEvents(
    aggregateId: string,
    events: DomainEvent[],
    expectedVersion: number
  ): Promise<void>;

  /**
   * Get events for an aggregate
   */
  getEvents(
    aggregateId: string,
    fromVersion?: number,
    toVersion?: number
  ): Promise<DomainEvent[]>;

  /**
   * Get events by type
   */
  getEventsByType(
    eventType: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<DomainEvent[]>;

  /**
   * Get events by correlation ID
   */
  getEventsByCorrelationId(correlationId: string): Promise<DomainEvent[]>;

  /**
   * Create a snapshot of an aggregate
   */
  saveSnapshot(
    aggregateId: string,
    aggregateType: string,
    version: number,
    data: Record<string, any>
  ): Promise<void>;

  /**
   * Get the latest snapshot for an aggregate
   */
  getSnapshot(aggregateId: string): Promise<{
    version: number;
    data: Record<string, any>;
  } | null>;
}
