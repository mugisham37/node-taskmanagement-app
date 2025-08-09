import { DomainEvent } from './domain-event';

export class NotificationCreatedEvent extends DomainEvent {
  constructor(
    public readonly notificationId: string,
    public readonly userId: string,
    public readonly type: string,
    public readonly title: string
  ) {
    super('NotificationCreated', {
      notificationId,
      userId,
      type,
      title,
    });
  }
}

export class NotificationSentEvent extends DomainEvent {
  constructor(
    public readonly notificationId: string,
    public readonly userId: string,
    public readonly channels: string[]
  ) {
    super('NotificationSent', {
      notificationId,
      userId,
      channels,
    });
  }
}

export class NotificationReadEvent extends DomainEvent {
  constructor(
    public readonly notificationId: string,
    public readonly userId: string,
    public readonly readAt: Date
  ) {
    super('NotificationRead', {
      notificationId,
      userId,
      readAt,
    });
  }
}

export class NotificationFailedEvent extends DomainEvent {
  constructor(
    public readonly notificationId: string,
    public readonly userId: string,
    public readonly reason: string,
    public readonly retryCount: number
  ) {
    super('NotificationFailed', {
      notificationId,
      userId,
      reason,
      retryCount,
    });
  }
}
