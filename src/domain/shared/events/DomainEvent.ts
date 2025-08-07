export abstract class DomainEvent {
  public readonly eventName: string;
  public readonly occurredAt: Date;
  public readonly eventId: string;
  public readonly data: Record<string, any>;

  constructor(eventName: string, data: Record<string, any> = {}) {
    this.eventName = eventName;
    this.occurredAt = new Date();
    this.eventId = this.generateEventId();
    this.data = data;
  }

  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public toJSON(): Record<string, any> {
    return {
      eventId: this.eventId,
      eventName: this.eventName,
      occurredAt: this.occurredAt.toISOString(),
      data: this.data,
    };
  }
}
