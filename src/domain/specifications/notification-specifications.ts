import { Specification } from './specification';
import {
  Notification,
  NotificationStatus,
  NotificationType,
} from '../entities/notification';

export class NotificationIsReadyToSendSpecification extends Specification<Notification> {
  isSatisfiedBy(notification: Notification): boolean {
    return notification.isReadyToSend();
  }
}

export class NotificationCanRetrySpecification extends Specification<Notification> {
  isSatisfiedBy(notification: Notification): boolean {
    return notification.canRetry();
  }
}

export class NotificationIsExpiredSpecification extends Specification<Notification> {
  isSatisfiedBy(notification: Notification): boolean {
    return notification.isExpired();
  }
}

export class NotificationIsScheduledSpecification extends Specification<Notification> {
  isSatisfiedBy(notification: Notification): boolean {
    return notification.isScheduled();
  }
}

export class NotificationByTypeSpecification extends Specification<Notification> {
  constructor(private readonly type: NotificationType) {
    super();
  }

  isSatisfiedBy(notification: Notification): boolean {
    return notification.type === this.type;
  }
}

export class NotificationByStatusSpecification extends Specification<Notification> {
  constructor(private readonly status: NotificationStatus) {
    super();
  }

  isSatisfiedBy(notification: Notification): boolean {
    return notification.status === this.status;
  }
}

export class NotificationByUserSpecification extends Specification<Notification> {
  constructor(private readonly userId: string) {
    super();
  }

  isSatisfiedBy(notification: Notification): boolean {
    return notification.userId === this.userId;
  }
}

export class NotificationByWorkspaceSpecification extends Specification<Notification> {
  constructor(private readonly workspaceId: string) {
    super();
  }

  isSatisfiedBy(notification: Notification): boolean {
    return notification.workspaceId === this.workspaceId;
  }
}

export class NotificationIsUnreadSpecification extends Specification<Notification> {
  isSatisfiedBy(notification: Notification): boolean {
    return !notification.isRead();
  }
}

export class NotificationCreatedAfterSpecification extends Specification<Notification> {
  constructor(private readonly date: Date) {
    super();
  }

  isSatisfiedBy(notification: Notification): boolean {
    return notification.createdAt > this.date;
  }
}

export class NotificationCreatedBeforeSpecification extends Specification<Notification> {
  constructor(private readonly date: Date) {
    super();
  }

  isSatisfiedBy(notification: Notification): boolean {
    return notification.createdAt < this.date;
  }
}
