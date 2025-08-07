import { createId } from '@paralleldrive/cuid2';

export abstract class DomainEvent {
  public readonly eventId: string;
  public readonly eventName: string;
  public readonly aggregateId: string;
  public readonly occurredAt: Date;
  public readonly version: number;
  public readonly metadata: Record<string, any>;

  constructor(
    eventName: string,
    aggregateId: string,
    version: number = 1,
    metadata: Record<string, any> = {}
  ) {
    this.eventId = createId();
    this.eventName = eventName;
    this.aggregateId = aggregateId;
    this.occurredAt = new Date();
    this.version = version;
    this.metadata = metadata;
  }

  public toJSON(): Record<string, any> {
    return {
      eventId: this.eventId,
      eventName: this.eventName,
      aggregateId: this.aggregateId,
      occurredAt: this.occurredAt.toISOString(),
      version: this.version,
      metadata: this.metadata,
    };
  }

  public equals(other: DomainEvent): boolean {
    return this.eventId === other.eventId;
  }
}
