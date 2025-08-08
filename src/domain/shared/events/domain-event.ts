import { v4 as uuidv4 } from 'uuid';

export abstract class DomainEvent {
  public readonly eventId: string;
  public readonly eventName: string;
  public readonly occurredAt: Date;
  public readonly version: number;
  public readonly correlationId?: string;
  public readonly causationId?: string;

  constructor(correlationId?: string, causationId?: string, occurredAt?: Date) {
    this.eventId = uuidv4();
    this.eventName = this.constructor.name;
    this.occurredAt = occurredAt || new Date();
    this.version = 1;
    this.correlationId = correlationId;
    this.causationId = causationId;
  }

  public abstract getAggregateId(): string;
  public abstract getAggregateType(): string;
  public abstract getEventData(): Record<string, any>;

  public toJSON(): Record<string, any> {
    return {
      eventId: this.eventId,
      eventName: this.eventName,
      aggregateId: this.getAggregateId(),
      aggregateType: this.getAggregateType(),
      occurredAt: this.occurredAt.toISOString(),
      version: this.version,
      correlationId: this.correlationId,
      causationId: this.causationId,
      data: this.getEventData(),
    };
  }

  public equals(other: DomainEvent): boolean {
    return this.eventId === other.eventId;
  }

  public withCorrelation(
    correlationId: string,
    causationId?: string
  ): DomainEvent {
    const event = Object.create(Object.getPrototypeOf(this));
    Object.assign(event, this);
    event.correlationId = correlationId;
    event.causationId = causationId || this.eventId;
    return event;
  }
}

export interface DomainEventHandler<T extends DomainEvent = DomainEvent> {
  handle(event: T): Promise<void>;
  canHandle(event: DomainEvent): boolean;
}

export interface DomainEventSubscription {
  unsubscribe(): void;
}

export interface EventMetadata {
  correlationId?: string;
  causationId?: string;
  userId?: string;
  workspaceId?: string;
  timestamp: Date;
  version: number;
}
