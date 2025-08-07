import { v4 as uuidv4 } from 'uuid';

export abstract class DomainEvent {
  public readonly eventId: string;
  public readonly eventName: string;
  public readonly occurredAt: Date;
  public readonly version: number;

  constructor(occurredOn?: Date) {
    this.eventId = uuidv4();
    this.eventName = this.constructor.name;
    this.occurredAt = occurredOn || new Date();
    this.version = 1;
  }

  public abstract getAggregateId(): string;
  public abstract getEventData(): Record<string, any>;

  public toJSON(): Record<string, any> {
    return {
      eventId: this.eventId,
      eventName: this.eventName,
      aggregateId: this.getAggregateId(),
      occurredAt: this.occurredAt.toISOString(),
      version: this.version,
      data: this.getEventData(),
    };
  }

  public equals(other: DomainEvent): boolean {
    return this.eventId === other.eventId;
  }
}
