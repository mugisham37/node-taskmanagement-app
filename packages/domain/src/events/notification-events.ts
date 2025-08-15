import { BaseDomainEvent } from './domain-event';
import { NotificationChannel } from '../entities/notification';

/**
 * Notification Created Event
 */
export class NotificationCreatedEvent extends BaseDomainEvent {
  constructor(
    public readonly notificationId: string,
    public readonly userId: string,
    public readonly type: string,
    public readonly title: string
  ) {
    super();
  }

  getEventName(): string {
    return 'NotificationCreated';
  }

  getAggregateId(): string {
    return this.notificationId;
  }

  protected getPayload(): Record<string, any> {
    return {
      notificationId: this.notificationId,
      userId: this.userId,
      type: this.type,
      title: this.title,
    };
  }
}

/**
 * Notification Sent Event
 */
export class NotificationSentEvent extends BaseDomainEvent {
  constructor(
    public readonly notificationId: string,
    public readonly userId: string,
    public readonly channels: NotificationChannel[]
  ) {
    super();
  }

  getEventName(): string {
    return 'NotificationSent';
  }

  getAggregateId(): string {
    return this.notificationId;
  }

  protected getPayload(): Record<string, any> {
    return {
      notificationId: this.notificationId,
      userId: this.userId,
      channels: this.channels,
    };
  }
}

/**
 * Notification Read Event
 */
export class NotificationReadEvent extends BaseDomainEvent {
  constructor(
    public readonly notificationId: string,
    public readonly userId: string,
    public readonly readAt: Date
  ) {
    super();
  }

  getEventName(): string {
    return 'NotificationRead';
  }

  getAggregateId(): string {
    return this.notificationId;
  }

  protected getPayload(): Record<string, any> {
    return {
      notificationId: this.notificationId,
      userId: this.userId,
      readAt: this.readAt.toISOString(),
    };
  }
}

/**
 * Notification Failed Event
 */
export class NotificationFailedEvent extends BaseDomainEvent {
  constructor(
    public readonly notificationId: string,
    public readonly userId: string,
    public readonly reason: string,
    public readonly retryCount: number
  ) {
    super();
  }

  getEventName(): string {
    return 'NotificationFailed';
  }

  getAggregateId(): string {
    return this.notificationId;
  }

  protected getPayload(): Record<string, any> {
    return {
      notificationId: this.notificationId,
      userId: this.userId,
      reason: this.reason,
      retryCount: this.retryCount,
    };
  }
}
