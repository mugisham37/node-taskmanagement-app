export interface DomainEvent {
    readonly eventId: string;
    readonly occurredOn: Date;
    readonly eventVersion: number;
}

export interface IntegrationEvent extends DomainEvent {
    readonly correlationId: string;
    readonly causationId: string;
}

export interface EventMetadata {
    eventId: string;
    occurredOn: Date;
    eventVersion: number;
    correlationId?: string;
    causationId?: string;
    userId?: string;
    sessionId?: string;
}
