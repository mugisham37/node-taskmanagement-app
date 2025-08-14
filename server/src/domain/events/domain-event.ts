/**
 * Base Domain Event interface
 */
export interface IDomainEvent {
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
export abstract class DomainEvent implements IDomainEvent {
  protected readonly eventId: string;
  protected readonly occurredOn: Date;
  protected readonly version: number;
  protected readonly metadata: Record<string, any>;

  constructor(
    metadata: Record<string, any> = {},
    version: number = 1
  ) {
    this.eventId = this.generateEventId();
    this.occurredOn = new Date();
    this.version = version;
    this.metadata = metadata;
  }

  getEventId(): string {
    return this.eventId;
  }

  abstract getEventName(): string;
  abstract getAggregateId(): string;
  protected abstract getPayload(): Record<string, any>;

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
    return this.getPayload();
  }

  // Add getter for backward compatibility with event handlers
  get occurredAt(): Date {
    return this.occurredOn;
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export BaseDomainEvent for backward compatibility
export { DomainEvent as BaseDomainEvent };
