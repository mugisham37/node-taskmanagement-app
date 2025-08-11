import { IdGenerator } from '../../shared/utils/id-generator';

/**
 * Base Domain Event interface
 */
export interface DomainEvent {
  /**
   * Get the unique event identifier
   */
  getEventId(): string;

  /**
   * Get the event name/type
   */
  getEventName(): string;

  /**
   * Get the aggregate ID that generated this event
   */
  getAggregateId(): string;

  /**
   * Get the event occurrence timestamp
   */
  getOccurredOn(): Date;

  /**
   * Get the event version for compatibility
   */
  getVersion(): number;

  /**
   * Get event metadata
   */
  getMetadata(): Record<string, any>;

  /**
   * Get event payload data
   */
  getEventData(): Record<string, any>;
}

/**
 * Abstract base class for domain events
 */
export abstract class BaseDomainEvent implements DomainEvent {
  protected readonly eventId: string;
  protected readonly aggregateId: string;
  protected readonly occurredOn: Date;
  protected readonly version: number;
  protected readonly metadata: Record<string, any>;
  protected readonly eventData: Record<string, any>;

  constructor(
    aggregateId: string,
    eventData: Record<string, any> = {},
    metadata: Record<string, any> = {},
    version: number = 1
  ) {
    this.eventId = this.generateEventId();
    this.aggregateId = aggregateId;
    this.occurredOn = new Date();
    this.version = version;
    this.metadata = metadata;
    this.eventData = eventData;
  }

  getEventId(): string {
    return this.eventId;
  }

  abstract getEventName(): string;

  getAggregateId(): string {
    return this.aggregateId;
  }

  getOccurredOn(): Date {
    return this.occurredOn;
  }

  getVersion(): number {
    return this.version;
  }

  getMetadata(): Record<string, any> {
    return { ...this.metadata };
  }

  getEventData(): Record<string, any> {
    return { ...this.eventData };
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
