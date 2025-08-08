import { randomUUID } from 'crypto';

/**
 * Base interface for all domain events
 * Domain events represent something important that happened in the domain
 */
export interface DomainEvent {
  readonly eventId: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly occurredOn: Date;
  readonly eventData: Record<string, any>;
  readonly version: number;
}

/**
 * Abstract base class for domain events
 * Provides common functionality for all domain events
 */
export abstract class BaseDomainEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly occurredOn: Date;
  public readonly version: number;

  protected constructor(
    public readonly aggregateId: string,
    public readonly eventType: string,
    public readonly eventData: Record<string, any>,
    version: number = 1
  ) {
    this.eventId = randomUUID();
    this.occurredOn = new Date();
    this.version = version;

    if (!aggregateId) {
      throw new Error('Aggregate ID is required for domain events');
    }
    if (!eventType) {
      throw new Error('Event type is required for domain events');
    }
  }

  /**
   * Converts the event to a primitive object for serialization
   */
  toPrimitive(): Record<string, any> {
    return {
      eventId: this.eventId,
      aggregateId: this.aggregateId,
      eventType: this.eventType,
      occurredOn: this.occurredOn.toISOString(),
      eventData: this.eventData,
      version: this.version,
    };
  }

  /**
   * Creates a domain event from primitive data
   */
  static fromPrimitive(data: Record<string, any>): DomainEvent {
    return {
      eventId: data.eventId,
      aggregateId: data.aggregateId,
      eventType: data.eventType,
      occurredOn: new Date(data.occurredOn),
      eventData: data.eventData,
      version: data.version || 1,
    };
  }
}

/**
 * Interface for domain event handlers
 */
export interface DomainEventHandler<T extends DomainEvent = DomainEvent> {
  handle(event: T): Promise<void>;
}

/**
 * Interface for domain event bus
 */
export interface DomainEventBus {
  publish(event: DomainEvent): Promise<void>;
  publishAll(events: DomainEvent[]): Promise<void>;
  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: DomainEventHandler<T>
  ): void;
}
