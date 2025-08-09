import { IdGenerator } from '../../shared/utils/id-generator';

/**
 * Base class for all domain events
 */
export abstract class DomainEvent {
  public readonly eventId: string;
  public readonly occurredAt: Date;
  public readonly eventVersion: number;

  constructor(eventVersion: number = 1) {
    this.eventId = IdGenerator.generate();
    this.occurredAt = new Date();
    this.eventVersion = eventVersion;
  }

  /**
   * Get the event name for serialization and routing
   */
  abstract getEventName(): string;

  /**
   * Get the aggregate ID that this event belongs to
   */
  abstract getAggregateId(): string;

  /**
   * Serialize the event for storage or transmission
   */
  toJSON(): Record<string, any> {
    return {
      eventId: this.eventId,
      eventName: this.getEventName(),
      aggregateId: this.getAggregateId(),
      occurredAt: this.occurredAt.toISOString(),
      eventVersion: this.eventVersion,
      payload: this.getPayload(),
    };
  }

  /**
   * Get the event payload - to be implemented by concrete events
   */
  protected abstract getPayload(): Record<string, any>;
}
