/**
 * Base domain event interface
 */
export interface DomainEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly eventVersion: number;
  readonly occurredAt: Date;
  readonly payload: Record<string, any>;
  readonly correlationId?: string;
  readonly causationId?: string;
}

/**
 * Domain event handler interface
 */
export interface DomainEventHandler<T extends DomainEvent> {
  handle(event: T): Promise<void>;
}

/**
 * Event bus interface
 */
export interface IEventBus {
  publish(event: DomainEvent): Promise<void>;
  publishAll(events: DomainEvent[]): Promise<void>;
  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: DomainEventHandler<T>
  ): void;
}

/**
 * Base domain event class
 */
export abstract class BaseDomainEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventVersion: number = 1;
  public readonly occurredAt: Date;

  constructor(
    public readonly eventType: string,
    public readonly aggregateId: string,
    public readonly aggregateType: string,
    public readonly payload: Record<string, any>,
    public readonly correlationId?: string,
    public readonly causationId?: string
  ) {
    this.eventId = this.generateEventId();
    this.occurredAt = new Date();
  }

  private generateEventId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
