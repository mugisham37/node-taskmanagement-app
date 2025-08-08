import { v4 as uuidv4 } from 'uuid';

export abstract class IntegrationEvent {
  public readonly eventId: string;
  public readonly eventName: string;
  public readonly eventVersion: string;
  public readonly occurredAt: Date;
  public readonly correlationId?: string;
  public readonly causationId?: string;
  public readonly source: EventSource;

  constructor(
    source: EventSource,
    correlationId?: string,
    causationId?: string,
    occurredAt?: Date
  ) {
    this.eventId = uuidv4();
    this.eventName = this.constructor.name;
    this.eventVersion = this.getEventVersion();
    this.occurredAt = occurredAt || new Date();
    this.correlationId = correlationId;
    this.causationId = causationId;
    this.source = source;
  }

  public abstract getEventVersion(): string;
  public abstract getEventData(): Record<string, any>;
  public abstract getRoutingKey(): string;

  public toJSON(): Record<string, any> {
    return {
      eventId: this.eventId,
      eventName: this.eventName,
      eventVersion: this.eventVersion,
      occurredAt: this.occurredAt.toISOString(),
      correlationId: this.correlationId,
      causationId: this.causationId,
      source: this.source,
      data: this.getEventData(),
      routingKey: this.getRoutingKey(),
    };
  }

  public serialize(): string {
    return JSON.stringify(this.toJSON());
  }

  public static deserialize<T extends IntegrationEvent>(
    json: string,
    eventClass: new (...args: any[]) => T
  ): T {
    const data = JSON.parse(json);

    // This is a simplified deserialization - in practice, you'd need
    // more sophisticated logic to handle different event versions
    const event = Object.create(eventClass.prototype);
    Object.assign(event, data);
    event.occurredAt = new Date(data.occurredAt);

    return event;
  }

  public equals(other: IntegrationEvent): boolean {
    return this.eventId === other.eventId;
  }

  public withCorrelation(
    correlationId: string,
    causationId?: string
  ): IntegrationEvent {
    const event = Object.create(Object.getPrototypeOf(this));
    Object.assign(event, this);
    event.correlationId = correlationId;
    event.causationId = causationId || this.eventId;
    return event;
  }
}

export interface EventSource {
  service: string;
  version: string;
  instance?: string;
  userId?: string;
  workspaceId?: string;
}

export interface IntegrationEventHandler<
  T extends IntegrationEvent = IntegrationEvent,
> {
  handle(event: T): Promise<void>;
  canHandle(event: IntegrationEvent): boolean;
  getHandledEventTypes(): string[];
}

export interface IntegrationEventSubscription {
  unsubscribe(): void;
}

export interface EventDeliveryOptions {
  retryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
  priority?: 'high' | 'normal' | 'low';
  persistent?: boolean;
}

export interface EventFilter {
  eventTypes?: string[];
  eventVersions?: string[];
  sources?: string[];
  routingKeys?: string[];
  customFilter?: (event: IntegrationEvent) => boolean;
}
